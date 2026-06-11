package github

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const (
	githubUsername = "guitaripod"
	graphQLURL     = "https://api.github.com/graphql"
)

var excludeRepos = []string{
	"guitaripod",
	"resume",
	"project-motivation-portfolio",
	"homebrew-apod-cli",
	"homebrew-songlink-cli",
	"claudeconfig",
	"macconfig",
	"archconfig",
	"ghostty-config",
	"igscraper",
	"torrent-rss",
	"JewOrNotJewKit",
	"twitter-reply-selector",
	"xthemetoggler",
	"postynstableview",
}

var forceIncludeRepos = []string{
	"wwdc-sessions",
	"silphscope",
}

var categoryOverrides = map[string]string{
	"gh-export":      "CLI Tools",
	"emusync":        "CLI Tools",
	"swollama":       "Swift Packages",
	"pixie":          "Apps",
	"anvil":          "Apps",
	"crucible":       "Apps",
	"flaccy":         "Apps",
	"btop-ios":       "Apps",
	"appofthedead":   "Apps",
	"psybeam":        "Apps",
	"silphscope":     "Apps",
	"sora-engine":    "Apps",
	"legendstracker": "Apps",
	"chatgpt-gtk4":   "Other Projects",
	"wwdc-sessions":  "AI & Agents",
	"weavex":         "AI & Agents",
	"omnichat":       "AI & Agents",
}

type Project struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	Language     string   `json:"language"`
	Platforms    []string `json:"platforms"`
	Stars        int      `json:"stars"`
	GitHubURL    string   `json:"githubUrl"`
	Category     string   `json:"category"`
	Highlights   []string `json:"highlights"`
	UpdatedAt    string   `json:"updatedAt"`
	CreatedAt    string   `json:"createdAt"`
	Topics       []string `json:"topics"`
	CommitCount  int      `json:"commitCount"`
	ReleaseCount int      `json:"releaseCount"`
	HomepageURL  string   `json:"homepageUrl,omitempty"`
}

type OpenSourceData struct {
	LastUpdated string    `json:"lastUpdated"`
	TotalRepos  int       `json:"totalRepos"`
	Projects    []Project `json:"projects"`
}

type graphQLRepo struct {
	Name            string `json:"name"`
	Description     string `json:"description"`
	URL             string `json:"url"`
	HomepageURL     string `json:"homepageUrl"`
	StargazerCount  int    `json:"stargazerCount"`
	IsArchived      bool   `json:"isArchived"`
	IsPrivate       bool   `json:"isPrivate"`
	CreatedAt       string `json:"createdAt"`
	PushedAt        string `json:"pushedAt"`
	PrimaryLanguage *struct {
		Name string `json:"name"`
	} `json:"primaryLanguage"`
	RepositoryTopics struct {
		Nodes []struct {
			Topic struct {
				Name string `json:"name"`
			} `json:"topic"`
		} `json:"nodes"`
	} `json:"repositoryTopics"`
	Releases struct {
		TotalCount int `json:"totalCount"`
	} `json:"releases"`
	DefaultBranchRef *struct {
		Target struct {
			History struct {
				TotalCount int `json:"totalCount"`
			} `json:"history"`
		} `json:"target"`
	} `json:"defaultBranchRef"`
}

type graphQLResponse struct {
	Data struct {
		User struct {
			Repositories struct {
				TotalCount int           `json:"totalCount"`
				Nodes      []graphQLRepo `json:"nodes"`
				PageInfo   struct {
					HasNextPage bool   `json:"hasNextPage"`
					EndCursor   string `json:"endCursor"`
				} `json:"pageInfo"`
			} `json:"repositories"`
			PinnedItems struct {
				Nodes []struct {
					Name string `json:"name"`
				} `json:"nodes"`
			} `json:"pinnedItems"`
		} `json:"user"`
	} `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

// / FetchData regenerates src/data/opensource.json from a single GitHub GraphQL
// / query (stars, releases, commit counts, and topics for every repo at once).
// / Requires GITHUB_TOKEN; without it the existing data file is left untouched
// / so a build never destroys good data with a partial fetch.
func FetchData() error {
	fmt.Println("Fetching latest GitHub repository data...")

	token := os.Getenv("GITHUB_TOKEN")
	if token == "" {
		fmt.Println("⚠️  GITHUB_TOKEN not set — keeping existing opensource.json untouched.")
		fmt.Println("   Set GITHUB_TOKEN (e.g. GITHUB_TOKEN=$(gh auth token)) to refresh data.")
		return nil
	}

	repos, pinned, totalRepos, err := fetchAllRepos(token)
	if err != nil {
		return fmt.Errorf("GraphQL fetch failed: %w", err)
	}
	fmt.Printf("✓ Fetched %d repositories in one GraphQL pass\n", len(repos))

	projects := curateProjects(repos)
	warnDeadConfig(projects)

	sort.Slice(projects, func(i, j int) bool {
		if projects[i].Stars != projects[j].Stars {
			return projects[i].Stars > projects[j].Stars
		}
		ti, _ := time.Parse(time.RFC3339, projects[i].UpdatedAt)
		tj, _ := time.Parse(time.RFC3339, projects[j].UpdatedAt)
		return ti.After(tj)
	})

	outputData := OpenSourceData{
		LastUpdated: time.Now().Format(time.RFC3339),
		TotalRepos:  totalRepos,
		Projects:    projects,
	}

	outputPath := filepath.Join("src", "data", "opensource.json")
	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	jsonData, err := json.MarshalIndent(outputData, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal data: %w", err)
	}

	if err := os.WriteFile(outputPath, append(jsonData, '\n'), 0644); err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}

	fmt.Printf("✓ Wrote %d curated projects to %s\n", len(projects), outputPath)
	printSummary(projects, pinned)
	return nil
}

func fetchAllRepos(token string) ([]graphQLRepo, []string, int, error) {
	var allRepos []graphQLRepo
	var pinned []string
	totalRepos := 0
	cursor := ""

	for {
		after := ""
		if cursor != "" {
			after = fmt.Sprintf(`, after: "%s"`, cursor)
		}
		query := fmt.Sprintf(`{
			user(login: "%s") {
				repositories(first: 50%s, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, orderBy: {field: PUSHED_AT, direction: DESC}) {
					totalCount
					pageInfo { hasNextPage endCursor }
					nodes {
						name description url homepageUrl stargazerCount isArchived isPrivate createdAt pushedAt
						primaryLanguage { name }
						repositoryTopics(first: 10) { nodes { topic { name } } }
						releases { totalCount }
						defaultBranchRef { target { ... on Commit { history { totalCount } } } }
					}
				}
				pinnedItems(first: 6, types: REPOSITORY) { nodes { ... on Repository { name } } }
			}
		}`, githubUsername, after)

		body, err := json.Marshal(map[string]string{"query": query})
		if err != nil {
			return nil, nil, 0, err
		}

		respBody, err := postGraphQLWithRetry(token, body)
		if err != nil {
			return nil, nil, 0, err
		}

		var gqlResp graphQLResponse
		if err := json.Unmarshal(respBody, &gqlResp); err != nil {
			return nil, nil, 0, err
		}
		if len(gqlResp.Errors) > 0 {
			return nil, nil, 0, fmt.Errorf("GraphQL error: %s", gqlResp.Errors[0].Message)
		}

		reposPage := gqlResp.Data.User.Repositories
		totalRepos = reposPage.TotalCount
		allRepos = append(allRepos, reposPage.Nodes...)
		if len(pinned) == 0 {
			for _, node := range gqlResp.Data.User.PinnedItems.Nodes {
				pinned = append(pinned, strings.ToLower(node.Name))
			}
		}

		if !reposPage.PageInfo.HasNextPage {
			break
		}
		cursor = reposPage.PageInfo.EndCursor
	}

	return allRepos, pinned, totalRepos, nil
}

// / postGraphQLWithRetry retries transient 5xx responses from the GraphQL
// / endpoint, which intermittently 502s on commit-history-heavy queries.
func postGraphQLWithRetry(token string, body []byte) ([]byte, error) {
	client := &http.Client{Timeout: 60 * time.Second}
	var lastErr error

	for attempt := 1; attempt <= 4; attempt++ {
		if attempt > 1 {
			backoff := time.Duration(attempt*attempt) * time.Second
			fmt.Printf("  ⏳ Retry %d/4 in %v...\n", attempt, backoff)
			time.Sleep(backoff)
		}

		req, err := http.NewRequest("POST", graphQLURL, bytes.NewReader(body))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("User-Agent", "midgarcorp-static-site")

		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			continue
		}

		respBody, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = err
			continue
		}

		if resp.StatusCode == http.StatusOK {
			return respBody, nil
		}
		lastErr = fmt.Errorf("GitHub GraphQL responded with %d", resp.StatusCode)
		if resp.StatusCode < 500 {
			return nil, fmt.Errorf("%w: %s", lastErr, string(respBody))
		}
	}

	return nil, lastErr
}

// / curateProjects keeps repos that represent shipped, portfolio-worthy work:
// / described, public, not archived, and either released, starred, or with a
// / substantial commit history.
func curateProjects(repos []graphQLRepo) []Project {
	var projects []Project
	for _, repo := range repos {
		if repo.IsPrivate || repo.IsArchived || contains(excludeRepos, repo.Name) || repo.Description == "" {
			continue
		}

		commitCount := 0
		if repo.DefaultBranchRef != nil {
			commitCount = repo.DefaultBranchRef.Target.History.TotalCount
		}
		releaseCount := repo.Releases.TotalCount

		forced := contains(forceIncludeRepos, repo.Name)
		if !forced && releaseCount < 1 && repo.StargazerCount < 2 && commitCount < 40 {
			continue
		}

		language := "Unknown"
		if repo.PrimaryLanguage != nil {
			language = repo.PrimaryLanguage.Name
		}

		var topics []string
		for _, t := range repo.RepositoryTopics.Nodes {
			topics = append(topics, t.Topic.Name)
		}
		if topics == nil {
			topics = []string{}
		}

		project := Project{
			ID:           strings.ToLower(repo.Name),
			Name:         repo.Name,
			Description:  repo.Description,
			Language:     language,
			Platforms:    getPlatforms(repo.Name, repo.Description, language),
			Stars:        repo.StargazerCount,
			GitHubURL:    repo.URL,
			Category:     categorizeProject(repo.Name, repo.Description, language, topics),
			Highlights:   getHighlights(repo.Description, topics),
			UpdatedAt:    repo.PushedAt,
			CreatedAt:    repo.CreatedAt,
			Topics:       topics,
			CommitCount:  commitCount,
			ReleaseCount: releaseCount,
			HomepageURL:  repo.HomepageURL,
		}
		projects = append(projects, project)
	}
	return projects
}

func categorizeProject(name, description, language string, topics []string) string {
	nameLower := strings.ToLower(name)
	if override, ok := categoryOverrides[nameLower]; ok {
		return override
	}
	desc := strings.ToLower(description)

	switch {
	case language == "Swift" && (strings.HasSuffix(nameLower, "kit") || hasWord(desc, "sdk") || hasWord(desc, "package")):
		return "Swift Packages"
	case hasWord(desc, "sdk"):
		return "SDKs & Libraries"
	case strings.Contains(nameLower, "-cli") || hasWord(desc, "cli") ||
		hasWord(desc, "tui") || hasWord(desc, "terminal") || hasWord(desc, "command-line") ||
		contains(topics, "cli"):
		return "CLI Tools"
	case language == "Swift" && (hasWord(desc, "ios") || hasWord(desc, "watchos") || strings.Contains(desc, "apple tv") || hasWord(desc, "client") || hasWord(desc, "app")):
		return "Apps"
	case language == "Swift":
		return "Swift Projects"
	case language == "Rust":
		return "Rust Projects"
	case language == "Go":
		return "Go Projects"
	default:
		return "Other Projects"
	}
}

// / hasWord reports whether desc contains word bounded by non-letters, so
// / "cli" does not match inside "client".
func hasWord(desc, word string) bool {
	idx := 0
	for {
		i := strings.Index(desc[idx:], word)
		if i < 0 {
			return false
		}
		start := idx + i
		end := start + len(word)
		beforeOK := start == 0 || !isLetter(desc[start-1])
		afterOK := end == len(desc) || !isLetter(desc[end])
		if beforeOK && afterOK {
			return true
		}
		idx = end
	}
}

func isLetter(b byte) bool {
	return (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z')
}

func getHighlights(description string, topics []string) []string {
	var highlights []string
	desc := strings.ToLower(description)

	add := func(h string) {
		if len(highlights) < 3 && !containsIgnoreCase(highlights, h) {
			highlights = append(highlights, h)
		}
	}

	if hasWord(desc, "local llm") || hasWord(desc, "local-llm") || hasWord(desc, "ollama") || hasWord(desc, "mlx") {
		add("Local LLMs")
	} else if hasWord(desc, "ai") || hasWord(desc, "llm") || hasWord(desc, "agent") {
		add("AI-powered")
	}
	if hasWord(desc, "cloudflare") || contains(topics, "cloudflare") {
		add("Cloudflare Workers")
	}
	if strings.Contains(desc, "cross-compiled") || strings.Contains(desc, "cross-platform") {
		add("Cross-platform")
	}
	if hasWord(desc, "tui") {
		add("TUI")
	}
	if hasWord(desc, "wasm") || contains(topics, "wasm") {
		add("WASM")
	}

	for _, topic := range topics {
		if len(highlights) >= 3 {
			break
		}
		add(topicLabel(topic))
	}

	if highlights == nil {
		return []string{}
	}
	return highlights
}

func getPlatforms(name, description, language string) []string {
	desc := strings.ToLower(description)
	nameLower := strings.ToLower(name)

	var platforms []string
	switch {
	case hasWord(desc, "ios"):
		platforms = append(platforms, "iOS")
		if hasWord(desc, "linux") {
			platforms = append(platforms, "Linux")
		}
	case hasWord(desc, "watchos"):
		platforms = append(platforms, "watchOS")
	case hasWord(desc, "android"):
		platforms = append(platforms, "Android")
	case hasWord(desc, "kde") || hasWord(desc, "wayland"):
		platforms = append(platforms, "Linux")
	case language == "Swift":
		platforms = append(platforms, "macOS")
		if hasWord(desc, "linux") {
			platforms = append(platforms, "Linux")
		}
	case language == "Go" || language == "Rust" || strings.Contains(nameLower, "-cli"):
		platforms = append(platforms, "macOS", "Linux", "Windows")
	}

	if platforms == nil {
		return []string{}
	}
	return platforms
}

func printSummary(projects []Project, pinned []string) {
	totalStars := 0
	for _, p := range projects {
		totalStars += p.Stars
	}
	fmt.Printf("\nProject stats: %d projects, %d total stars, %d pinned\n", len(projects), totalStars, len(pinned))
	fmt.Println("Top 5 projects by stars:")
	for i := 0; i < 5 && i < len(projects); i++ {
		p := projects[i]
		fmt.Printf("  %d. %s — %d stars, %d releases\n", i+1, p.Name, p.Stars, p.ReleaseCount)
	}
}

// / warnDeadConfig flags forceIncludeRepos and categoryOverrides entries that
// / produced no project, so curation config fails loudly instead of rotting.
func warnDeadConfig(projects []Project) {
	ids := make(map[string]bool, len(projects))
	for _, p := range projects {
		ids[p.ID] = true
	}
	for _, name := range forceIncludeRepos {
		if !ids[strings.ToLower(name)] {
			fmt.Printf("⚠️  forceIncludeRepos entry %q produced no project (private, archived, or missing description?)\n", name)
		}
	}
	for key := range categoryOverrides {
		if !ids[key] {
			fmt.Printf("⚠️  categoryOverrides entry %q matches no project\n", key)
		}
	}
}

var acronymTopics = map[string]string{
	"ai":       "AI",
	"openai":   "OpenAI",
	"sdk":      "SDK",
	"cli":      "CLI",
	"tui":      "TUI",
	"wasm":     "WASM",
	"llm":      "LLM",
	"llms-txt": "llms.txt",
	"mcp":      "MCP",
	"api":      "API",
	"ios":      "iOS",
	"macos":    "macOS",
	"watchos":  "watchOS",
	"nasa":     "NASA",
	"wwdc":     "WWDC",
	"xai":      "xAI",
}

func topicLabel(topic string) string {
	if label, ok := acronymTopics[topic]; ok {
		return label
	}
	if len(topic) == 0 {
		return topic
	}
	return strings.ToUpper(topic[:1]) + topic[1:]
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func containsIgnoreCase(slice []string, item string) bool {
	itemLower := strings.ToLower(item)
	for _, s := range slice {
		if strings.ToLower(s) == itemLower {
			return true
		}
	}
	return false
}
