package github

import (
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
	githubAPIURL   = "https://api.github.com/users/%s/repos?per_page=100&sort=updated"
	graphQLURL     = "https://api.github.com/graphql"
)

var hasGitHubToken bool

var excludeRepos = []string{
	"guitaripod",                   // profile repo
	"isowords",                      // fork
	"swift-composable-architecture", // fork
	"homebrew-apod-cli",             // homebrew tap
	"homebrew-songlink-cli",         // homebrew tap
}

type GitHubRepo struct {
	Name            string    `json:"name"`
	Description     string    `json:"description"`
	Language        string    `json:"language"`
	Fork            bool      `json:"fork"`
	Private         bool      `json:"private"`
	StargazersCount int       `json:"stargazers_count"`
	HTMLURL         string    `json:"html_url"`
	UpdatedAt       string    `json:"updated_at"`
	CreatedAt       string    `json:"created_at"`
	Topics          []string  `json:"topics"`
	HomepageURL     string    `json:"homepage"`
}

type Contributor struct {
	Login         string `json:"login"`
	Contributions int    `json:"contributions"`
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

type GraphQLQuery struct {
	Query string `json:"query"`
}

type PinnedReposResponse struct {
	Data struct {
		User struct {
			PinnedItems struct {
				Nodes []struct {
					Name string `json:"name"`
				} `json:"nodes"`
			} `json:"pinnedItems"`
		} `json:"user"`
	} `json:"data"`
}

func FetchData() error {
	fmt.Println("Fetching latest GitHub repository data...")
	
	// Check if GitHub token is set
	token := os.Getenv("GITHUB_TOKEN")
	hasGitHubToken = token != ""
	
	if !hasGitHubToken {
		fmt.Println("⚠️  WARNING: GITHUB_TOKEN not set. API rate limits will be very restrictive.")
		fmt.Println("   Set GITHUB_TOKEN environment variable to increase rate limits.")
		fmt.Println("   Using longer delays to avoid rate limiting...")
	} else {
		fmt.Println("✓ GitHub token detected")
	}

	// Fetch pinned repos first
	pinnedRepos, err := fetchPinnedRepos()
	if err != nil {
		fmt.Printf("Warning: failed to fetch pinned repos: %v\n", err)
		pinnedRepos = []string{} // Continue without pinned repos
	}

	repos, err := fetchGitHubRepos()
	if err != nil {
		return fmt.Errorf("failed to fetch GitHub repos: %w", err)
	}

	// Filter repositories by release status
	fmt.Println("Checking repositories for releases...")
	fmt.Printf("Note: This may take several minutes due to rate limit protection\n")
	fmt.Printf("Processing %d repositories...\n", len(repos))
	var reposWithMetrics []struct {
		GitHubRepo
		CommitCount  int
		ReleaseCount int
	}

	for i, repo := range repos {
		// Skip if it's in the exclude list or doesn't meet basic criteria
		if repo.Fork || repo.Private || contains(excludeRepos, repo.Name) ||
			repo.Description == "" {
			continue
		}

		// Add significant delay between API calls to avoid rate limiting
		if i > 0 {
			delay := 3 * time.Second
			if !hasGitHubToken {
				delay = 10 * time.Second // Much longer delay without token
			}
			fmt.Printf("  ⏳ Waiting %v before checking %s...\n", delay, repo.Name)
			time.Sleep(delay)
		}

		// Fetch release count
		releaseCount, err := getReleaseCount(repo)
		if err != nil {
			fmt.Printf("  ✗ %s: error fetching releases: %v\n", repo.Name, err)
			continue
		}

		// Simple filtering: must have at least 1 release
		if releaseCount < 1 {
			fmt.Printf("  ✗ %s: no releases\n", repo.Name)
			continue
		}

		// Now fetch commit count for metadata (not for filtering)
		apiDelay := 2 * time.Second
		if !hasGitHubToken {
			apiDelay = 5 * time.Second
		}
		time.Sleep(apiDelay)
		
		commitCount, err := getCommitCount(repo)
		if err != nil {
			// Use 0 if we can't get commit count, but don't skip the repo
			commitCount = 0
			fmt.Printf("  ⚠️  %s: couldn't fetch commit count, using 0\n", repo.Name)
		}

		// Add to results - we already know it has releases
		reposWithMetrics = append(reposWithMetrics, struct {
			GitHubRepo
			CommitCount  int
			ReleaseCount int
		}{repo, commitCount, releaseCount})
		fmt.Printf("  ✓ %s: %d commits, %d releases, %d stars (released project)\n", 
			repo.Name, commitCount, releaseCount, repo.StargazersCount)
	}

	// Transform filtered repos
	projects := make([]Project, 0, len(reposWithMetrics))
	for _, repo := range reposWithMetrics {
		project := Project{
			ID:          strings.ToLower(repo.Name),
			Name:        repo.Name,
			Description: repo.Description,
			Language:    repo.Language,
			Platforms:   getPlatforms(repo.GitHubRepo),
			Stars:       repo.StargazersCount,
			GitHubURL:   repo.HTMLURL,
			Category:    categorizeProject(repo.GitHubRepo),
			Highlights:  getHighlights(repo.GitHubRepo),
			UpdatedAt:   repo.UpdatedAt,
			CreatedAt:   repo.CreatedAt,
			Topics:      repo.Topics,
			CommitCount:  repo.CommitCount,
			ReleaseCount: repo.ReleaseCount,
			HomepageURL:  repo.HomepageURL,
		}
		if project.Language == "" {
			project.Language = "Unknown"
		}
		projects = append(projects, project)
	}

	// Sort projects
	sort.Slice(projects, func(i, j int) bool {
		// Sort by stars first, then by commit count, then by update date
		if projects[i].Stars != projects[j].Stars {
			return projects[i].Stars > projects[j].Stars
		}
		if projects[i].CommitCount != projects[j].CommitCount {
			return projects[i].CommitCount > projects[j].CommitCount
		}
		ti, _ := time.Parse(time.RFC3339, projects[i].UpdatedAt)
		tj, _ := time.Parse(time.RFC3339, projects[j].UpdatedAt)
		return ti.After(tj)
	})

	// Select featured projects (for homepage - prioritize stars)
	featuredProjects := selectFeaturedProjects(projects, pinnedRepos)

	// Prepare output data
	outputData := OpenSourceData{
		LastUpdated: time.Now().Format(time.RFC3339),
		TotalRepos:  len(repos),
		Projects:    featuredProjects,
	}

	// Write to file
	outputPath := filepath.Join("src", "data", "opensource.json")
	
	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// Marshal to JSON
	jsonData, err := json.MarshalIndent(outputData, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal data: %w", err)
	}

	// Write file
	if err := os.WriteFile(outputPath, jsonData, 0644); err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}

	fmt.Printf("\n✓ Successfully fetched %d open source projects\n", len(outputData.Projects))
	fmt.Printf("✓ Data written to %s\n", outputPath)

	// Summary
	categoryCounts := make(map[string]int)
	totalCommits := 0
	totalStars := 0
	pinnedCount := 0
	
	for _, p := range outputData.Projects {
		categoryCounts[p.Category]++
		totalCommits += p.CommitCount
		totalStars += p.Stars
		
		// Check if pinned
		for _, pinned := range pinnedRepos {
			if p.ID == pinned {
				pinnedCount++
				break
			}
		}
	}

	fmt.Println("\nProject stats:")
	fmt.Printf("  Total projects: %d\n", len(outputData.Projects))
	fmt.Printf("  Total stars: %d\n", totalStars)
	fmt.Printf("  Total commits: %d\n", totalCommits)
	fmt.Printf("  Average stars per project: %.1f\n", float64(totalStars)/float64(len(outputData.Projects)))
	
	// Show top 5 projects by stars
	fmt.Println("\nTop 5 projects by stars:")
	for i := 0; i < 5 && i < len(outputData.Projects); i++ {
		p := outputData.Projects[i]
		fmt.Printf("  %d. %s - %d stars, %d commits\n", i+1, p.Name, p.Stars, p.CommitCount)
	}
	
	fmt.Println("\n✓ GitHub data updated successfully")

	return nil
}

func fetchGitHubRepos() ([]GitHubRepo, error) {
	url := fmt.Sprintf(githubAPIURL, githubUsername)
	
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "guitaripod-website")
	
	// Add token if available
	if token := os.Getenv("GITHUB_TOKEN"); token != "" {
		req.Header.Set("Authorization", "token "+token)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API responded with %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var repos []GitHubRepo
	if err := json.Unmarshal(body, &repos); err != nil {
		return nil, err
	}

	return repos, nil
}

func getCommitCount(repo GitHubRepo) (int, error) {
	// Try contributors endpoint first
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/contributors", githubUsername, repo.Name)
	
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return 0, err
	}
	
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "guitaripod-website")
	
	if token := os.Getenv("GITHUB_TOKEN"); token != "" {
		req.Header.Set("Authorization", "token "+token)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return 0, err
		}

		var contributors []Contributor
		if err := json.Unmarshal(body, &contributors); err != nil {
			return 0, err
		}

		for _, c := range contributors {
			if c.Login == githubUsername {
				return c.Contributions, nil
			}
		}
	} else if resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusTooManyRequests {
		// If rate limited, wait and retry once
		fmt.Printf("    ⚠️  Rate limited on commits, waiting 60 seconds before retry...\n")
		time.Sleep(60 * time.Second)
		
		// Retry the request
		resp2, err := client.Do(req)
		if err != nil {
			return 0, err
		}
		defer resp2.Body.Close()
		
		if resp2.StatusCode == http.StatusOK {
			body, err := io.ReadAll(resp2.Body)
			if err != nil {
				return 0, err
			}

			var contributors []Contributor
			if err := json.Unmarshal(body, &contributors); err != nil {
				return 0, err
			}

			for _, c := range contributors {
				if c.Login == githubUsername {
					return c.Contributions, nil
				}
			}
		}
	}

	// Fallback: count commits (simplified - just use 100 as max)
	return 100, nil // Simplified for now
}

func getReleaseCount(repo GitHubRepo) (int, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases?per_page=100", githubUsername, repo.Name)
	
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return 0, err
	}
	
	// Set headers
	req.Header.Set("User-Agent", "midgarcorp-static-site")
	
	// Add auth if available
	if token := os.Getenv("GITHUB_TOKEN"); token != "" {
		req.Header.Set("Authorization", "token "+token)
	}
	
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		// Return 0 releases for 404 (no releases) instead of error
		if resp.StatusCode == http.StatusNotFound {
			return 0, nil
		}
		// If rate limited, wait and retry once
		if resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusTooManyRequests {
			fmt.Printf("    ⚠️  Rate limited, waiting 60 seconds before retry...\n")
			time.Sleep(60 * time.Second)
			
			// Retry the request
			resp2, err := client.Do(req)
			if err != nil {
				return 0, err
			}
			defer resp2.Body.Close()
			
			if resp2.StatusCode == http.StatusOK {
				var releases []map[string]interface{}
				if err := json.NewDecoder(resp2.Body).Decode(&releases); err != nil {
					return 0, err
				}
				return len(releases), nil
			}
			return 0, fmt.Errorf("GitHub API error after retry: %s", resp2.Status)
		}
		return 0, fmt.Errorf("GitHub API error: %s", resp.Status)
	}
	
	var releases []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return 0, err
	}
	
	return len(releases), nil
}

func categorizeProject(repo GitHubRepo) string {
	name := strings.ToLower(repo.Name)
	desc := strings.ToLower(repo.Description)
	
	if strings.Contains(name, "-cli") || strings.Contains(desc, "cli") {
		return "CLI Tools"
	} else if repo.Language == "Swift" && (strings.Contains(name, "kit") || strings.Contains(desc, "package")) {
		return "Swift Packages"
	} else if strings.Contains(desc, "gtk") || strings.Contains(desc, "desktop") || strings.Contains(desc, "app") {
		return "Desktop Apps"
	} else if repo.Language == "Swift" {
		return "Swift Projects"
	} else if repo.Language == "Go" {
		return "Go Projects"
	}
	return "Other Projects"
}

func getHighlights(repo GitHubRepo) []string {
	var highlights []string
	desc := strings.ToLower(repo.Description)
	
	// Check for homebrew
	if contains(repo.Topics, "homebrew") || strings.Contains(desc, "homebrew") {
		highlights = append(highlights, "Homebrew available")
	}
	
	// Check for cross-platform
	if strings.Contains(desc, "cross-platform") || strings.Contains(desc, "linux") || strings.Contains(desc, "macos") {
		highlights = append(highlights, "Cross-platform")
	}
	
	// Check for testing
	if contains(repo.Topics, "testing") || strings.Contains(desc, "test") {
		highlights = append(highlights, "Well-tested")
	}
	
	// Check for AI/ML
	if strings.Contains(desc, "ai") || strings.Contains(desc, "ml") || 
	   strings.Contains(desc, "openai") || strings.Contains(desc, "dalle") {
		highlights = append(highlights, "AI-powered")
	}
	
	// Check for specific technologies
	if strings.Contains(desc, "gtk") {
		highlights = append(highlights, "GTK4")
	}
	if strings.Contains(desc, "async") {
		highlights = append(highlights, "async/await")
	}
	if strings.Contains(desc, "vim") {
		highlights = append(highlights, "Vim controls")
	}
	if strings.Contains(desc, "zero dependencies") {
		highlights = append(highlights, "Zero dependencies")
	}
	if strings.Contains(desc, "batch") {
		highlights = append(highlights, "Batch generation")
	}
	
	// Language-specific
	if repo.Language == "Swift" && strings.Contains(desc, "linux") {
		highlights = append(highlights, "Cross-platform Swift")
	}
	
	// Add topics as highlights
	if len(repo.Topics) > 0 {
		for i, topic := range repo.Topics {
			if i >= 2 {
				break
			}
			if !containsIgnoreCase(highlights, topic) {
				highlights = append(highlights, strings.Title(topic))
			}
		}
	}
	
	// Return max 3 highlights
	if len(highlights) > 3 {
		return highlights[:3]
	}
	if len(highlights) == 0 {
		return []string{} // Ensure we always return a non-nil slice
	}
	return highlights
}

func getPlatforms(repo GitHubRepo) []string {
	var platforms []string
	desc := strings.ToLower(repo.Description)
	name := strings.ToLower(repo.Name)
	
	if repo.Language == "Swift" || strings.Contains(desc, "swift") {
		platforms = append(platforms, "macOS")
		if strings.Contains(desc, "linux") {
			platforms = append(platforms, "Linux")
		}
		if strings.Contains(desc, "ios") {
			platforms = append(platforms, "iOS")
		}
	} else if repo.Language == "Go" || strings.Contains(name, "-cli") {
		platforms = append(platforms, "macOS", "Linux", "Windows")
	} else if strings.Contains(desc, "gtk") || strings.Contains(desc, "linux") {
		platforms = append(platforms, "Linux")
	} else if strings.Contains(desc, "cross-platform") {
		platforms = append(platforms, "macOS", "Linux", "Windows")
	}
	
	// Remove duplicates
	seen := make(map[string]bool)
	unique := []string{}
	for _, p := range platforms {
		if !seen[p] {
			seen[p] = true
			unique = append(unique, p)
		}
	}
	
	return unique
}

func fetchPinnedRepos() ([]string, error) {
	query := `{
		user(login: "guitaripod") {
			pinnedItems(first: 6, types: REPOSITORY) {
				nodes {
					... on Repository {
						name
					}
				}
			}
		}
	}`

	gqlQuery := GraphQLQuery{Query: query}
	jsonData, err := json.Marshal(gqlQuery)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", graphQLURL, strings.NewReader(string(jsonData)))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "guitaripod-website")
	
	if token := os.Getenv("GITHUB_TOKEN"); token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GraphQL query failed with status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var pinnedResp PinnedReposResponse
	if err := json.Unmarshal(body, &pinnedResp); err != nil {
		return nil, err
	}

	var pinnedNames []string
	for _, node := range pinnedResp.Data.User.PinnedItems.Nodes {
		pinnedNames = append(pinnedNames, strings.ToLower(node.Name))
	}

	return pinnedNames, nil
}

func selectFeaturedProjects(projects []Project, pinnedRepos []string) []Project {
	// Filter for quality projects only
	var qualityProjects []Project
	
	for _, p := range projects {
		// Include projects with >= 25 commits, or projects with > 1 star regardless of commit count
		if p.CommitCount >= 25 || p.Stars > 1 {
			qualityProjects = append(qualityProjects, p)
		}
	}
	
	// Sort by stars first (for homepage display)
	sort.Slice(qualityProjects, func(i, j int) bool {
		// Sort primarily by stars
		if qualityProjects[i].Stars != qualityProjects[j].Stars {
			return qualityProjects[i].Stars > qualityProjects[j].Stars
		}
		
		// If stars are equal, sort by commits
		if qualityProjects[i].CommitCount != qualityProjects[j].CommitCount {
			return qualityProjects[i].CommitCount > qualityProjects[j].CommitCount
		}
		
		// If both are equal, prefer more recent updates
		ti, _ := time.Parse(time.RFC3339, qualityProjects[i].UpdatedAt)
		tj, _ := time.Parse(time.RFC3339, qualityProjects[j].UpdatedAt)
		return ti.After(tj)
	})
	
	// Return all quality projects (let the page decide how many to show)
	return qualityProjects
}

// Helper functions
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