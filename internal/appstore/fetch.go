package appstore

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

const (
	developerID = "1484270247"
	apiURL      = "https://itunes.apple.com/lookup?id=%s&entity=software&limit=200&country=us"
)

type iTunesResponse struct {
	Results []iTunesApp `json:"results"`
}

type iTunesApp struct {
	TrackID                   int      `json:"trackId"`
	TrackName                 string   `json:"trackName"`
	TrackViewURL              string   `json:"trackViewUrl"`
	Price                     float64  `json:"price"`
	Description               string   `json:"description"`
	PrimaryGenreName          string   `json:"primaryGenreName"`
	ArtworkURL512             string   `json:"artworkUrl512"`
	ArtworkURL100             string   `json:"artworkUrl100"`
	Kind                      string   `json:"kind"`
	ReleaseDate               string   `json:"releaseDate"`
	Version                   string   `json:"version"`
	CurrentVersionReleaseDate string   `json:"currentVersionReleaseDate"`
	MinimumOsVersion          string   `json:"minimumOsVersion"`
	AverageUserRating         float64  `json:"averageUserRating"`
	UserRatingCount           int      `json:"userRatingCount"`
	SupportedDevices          []string `json:"supportedDevices"`
	IPadScreenshotURLs        []string `json:"ipadScreenshotUrls"`
	ScreenshotURLs            []string `json:"screenshotUrls"`
}

type App struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Tagline      string   `json:"tagline"`
	Description  string   `json:"description"`
	Platforms    []string `json:"platforms"`
	Category     string   `json:"category"`
	Price        string   `json:"price"`
	AppStoreURL  string   `json:"appStoreUrl"`
	Icon         string   `json:"icon"`
	PrimaryColor string   `json:"primaryColor"`
	Features     []string `json:"features"`
	ReleaseDate  string   `json:"releaseDate"`
}

type AppsData struct {
	Apps []App `json:"apps"`
}

var appEnhancements = map[int]struct {
	ID           string
	Tagline      string
	Description  string
	PrimaryColor string
	Features     []string
	Platforms    []string
}{
	6705124497: {
		ID:           "solar-beam",
		Tagline:      "Your Window to the Universe",
		PrimaryColor: "#F59E0B",
		Features: []string{
			"Real-time space data",
			"Stunning 4K visualizations",
			"Educational astronomy content",
		},
		Platforms: []string{"Mac"},
	},
	6736438070: {
		ID:           "sforesight",
		Tagline:      "ML-Powered SF Symbol Search",
		PrimaryColor: "#3B82F6",
		Features: []string{
			"ML-powered semantic search",
			"Instant symbol preview",
			"Export in multiple formats",
		},
	},
	6736581403: {
		ID:           "double-kick",
		Tagline:      "Understand Any Menu, Anywhere",
		PrimaryColor: "#DC2626",
		Features: []string{
			"Instant menu translation",
			"Dietary restriction alerts",
			"Cuisine insights",
		},
	},
	6727000827: {
		ID:           "psywave",
		Tagline:      "AI-Powered Playlist Generation",
		PrimaryColor: "#8B5CF6",
		Features: []string{
			"ML-powered music analysis",
			"Mood-based playlist generation",
			"Apple Music integration",
		},
	},
	6661019277: {
		ID:           "dream-eater",
		Tagline:      "ML-Powered Dream Journaling",
		PrimaryColor: "#6366F1",
		Features: []string{
			"Dream pattern analysis",
			"AI-powered insights",
			"Private & secure journaling",
		},
	},
	1523538855: {
		ID:           "master-of-inventory",
		Tagline:      "Professional Inventory Management",
		PrimaryColor: "#10B981",
		Features: []string{
			"Barcode scanning",
			"Multi-location tracking",
			"Detailed analytics",
		},
	},
	1484270248: {
		ID:           "master-of-flags",
		Tagline:      "Learn World Flags",
		PrimaryColor: "#EF4444",
		Features: []string{
			"All country flags",
			"Interactive quizzes",
			"Progress tracking",
		},
	},
	6751730339: {
		ID:           "pixiepocket",
		Tagline:      "Create AI Images in Your Pocket",
		PrimaryColor: "#EC4899",
		Features: []string{
			"Advanced OpenAI gpt-image-1 integration",
			"Chat-based interface for natural prompting",
			"Persistent cloud storage with public galleries",
		},
	},
	6746733380: {
		ID:           "app-of-the-dead-afterlife",
		Tagline:      "Learn Afterlife Beliefs",
		PrimaryColor: "#7C3AED",
		Features: []string{
			"Local MLX LLM technology for offline AI",
			"Gamified learning with XP and achievements",
			"Interactive quizzes on world religions",
		},
	},
	6777952645: {
		ID:           "psybeam",
		Tagline:      "Hold Up Your Phone and Talk",
		Description:  "A real-time voice interpreter for travel. Hold your button and speak — it says it out loud in their language. The person across from you never touches the screen.",
		PrimaryColor: "#06B6D4",
		Features: []string{
			"Real-time voice-to-voice in 20+ languages",
			"Two thumb buttons — run both sides from one phone",
			"No account or subscription to start",
		},
	},
}

func FetchData() error {
	fmt.Println("Fetching latest App Store data...")
	fmt.Println("Fetching data from iTunes Search API...")

	apps, err := fetchAppStoreData()
	if err != nil {
		return fmt.Errorf("failed to fetch app store data: %w", err)
	}

	if len(apps) < len(appEnhancements) {
		fmt.Printf("⚠️  iTunes returned only %d apps (expected ≥%d) — keeping existing apps.json untouched.\n",
			len(apps), len(appEnhancements))
		return nil
	}

	fmt.Printf("Found %d apps\n", len(apps))

	// Sort apps by predefined order
	sortOrder := []string{
		"solar-beam",
		"sforesight",
		"double-kick",
		"psywave",
		"dream-eater",
		"master-of-inventory",
		"master-of-flags",
		"app-of-the-dead-afterlife",
		"pixiepocket",
	}

	sort.Slice(apps, func(i, j int) bool {
		iIndex := indexOf(sortOrder, apps[i].ID)
		jIndex := indexOf(sortOrder, apps[j].ID)
		if iIndex == -1 && jIndex == -1 {
			return false
		}
		if iIndex == -1 {
			return false
		}
		if jIndex == -1 {
			return true
		}
		return iIndex < jIndex
	})

	// Write data
	appsData := AppsData{Apps: apps}
	dataPath := filepath.Join("src", "data", "apps.json")

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(dataPath), 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// Marshal to JSON
	jsonData, err := json.MarshalIndent(appsData, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal data: %w", err)
	}

	// Write file
	if err := os.WriteFile(dataPath, append(jsonData, '\n'), 0644); err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}

	fmt.Printf("✓ Successfully updated %s\n", dataPath)
	fmt.Println("Apps updated:")
	for _, app := range apps {
		fmt.Printf("  - %s (%s)\n", app.Name, app.Price)
	}

	if n, err := refreshLiveFacts(); err != nil {
		fmt.Printf("⚠️  Could not refresh landing-live.json: %v\n", err)
	} else if n > 0 {
		fmt.Printf("✓ Refreshed live store facts for %d landing page(s)\n", n)
	}

	fmt.Println("✓ App Store data updated successfully")
	return nil
}

func fetchAppStoreData() ([]App, error) {
	body, err := getWithRetry(fmt.Sprintf(apiURL, developerID))
	if err != nil {
		return nil, err
	}

	var iTunesResp iTunesResponse
	if err := json.Unmarshal(body, &iTunesResp); err != nil {
		return nil, err
	}

	if len(iTunesResp.Results) == 0 {
		return nil, fmt.Errorf("no apps found for developer")
	}

	// First result is developer info, rest are apps
	iTunesApps := iTunesResp.Results[1:]

	apps := make([]App, 0, len(iTunesApps))
	for _, iTunesApp := range iTunesApps {
		app := transformiTunesApp(iTunesApp)
		apps = append(apps, app)
	}

	return apps, nil
}

func transformiTunesApp(app iTunesApp) App {
	enhancement, hasEnhancement := appEnhancements[app.TrackID]

	// Generate URL slug
	urlSlug := enhancement.ID
	if urlSlug == "" {
		urlSlug = strings.ToLower(app.TrackName)
		urlSlug = strings.ReplaceAll(urlSlug, " ", "-")
		urlSlug = strings.Map(func(r rune) rune {
			if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
				return r
			}
			return -1
		}, urlSlug)
	}

	// Extract clean description
	sentences := splitSentences(app.Description)
	cleanDesc := ""
	if len(sentences) >= 2 {
		cleanDesc = strings.Join(sentences[:2], " ")
	} else if len(sentences) == 1 {
		cleanDesc = sentences[0]
	}

	appStoreURL := canonicalStoreURL(app.TrackViewURL, urlSlug, app.TrackID)

	// Map platforms
	platforms := mapDeviceTosPlatform(app)

	// Determine price
	price := priceLabel(app.Price)

	// Choose icon
	icon := app.ArtworkURL512
	if icon == "" {
		icon = app.ArtworkURL100
	}

	// Build the app struct
	result := App{
		ID:          urlSlug,
		Name:        app.TrackName,
		Description: cleanDesc,
		Platforms:   platforms,
		Category:    app.PrimaryGenreName,
		Price:       price,
		AppStoreURL: appStoreURL,
		Icon:        icon,
		ReleaseDate: app.ReleaseDate,
	}

	// Apply enhancements
	if hasEnhancement {
		result.Tagline = enhancement.Tagline
		result.PrimaryColor = enhancement.PrimaryColor
		result.Features = enhancement.Features
		if enhancement.Description != "" {
			result.Description = enhancement.Description
		}
		if len(enhancement.Platforms) > 0 {
			result.Platforms = enhancement.Platforms
		}
	} else {
		result.Tagline = "Innovative app for Apple platforms"
		if len(sentences) > 0 && len(sentences[0]) <= 60 {
			result.Tagline = sentences[0]
		}
		result.PrimaryColor = "#3B82F6"
		result.Features = []string{}
	}

	return result
}

func mapDeviceTosPlatform(app iTunesApp) []string {
	// Check for macOS apps
	if app.Kind == "mac-software" {
		return []string{"Mac"}
	}

	// Check supported devices array
	if len(app.SupportedDevices) > 0 {
		// Mac apps report a MacDesktop device family even when kind stays "software"
		for _, device := range app.SupportedDevices {
			if strings.Contains(device, "Mac") {
				return []string{"Mac"}
			}
		}

		// Check for Apple TV
		for _, device := range app.SupportedDevices {
			if strings.Contains(device, "AppleTV") {
				return []string{"Apple TV"}
			}
		}

		// Check for iOS devices
		var platforms []string
		hasIPhone := false
		hasIPad := false

		for _, device := range app.SupportedDevices {
			if strings.Contains(device, "iPhone") {
				hasIPhone = true
			}
			if strings.Contains(device, "iPad") {
				hasIPad = true
			}
		}

		if hasIPhone {
			platforms = append(platforms, "iPhone")
		}
		if hasIPad {
			platforms = append(platforms, "iPad")
		}

		if len(platforms) > 0 {
			return platforms
		}
	}

	// Fallback: check screenshot URLs for iOS apps
	var platforms []string
	if len(app.IPadScreenshotURLs) > 0 {
		platforms = append(platforms, "iPad")
	}
	if len(app.ScreenshotURLs) > 0 {
		platforms = append(platforms, "iPhone")
	}

	if len(platforms) > 0 {
		return platforms
	}

	return []string{"iPhone", "iPad"}
}

// / getWithRetry retries transient failures from the iTunes lookup API, which
// / intermittently returns 5xx or truncated result sets.
func getWithRetry(url string) ([]byte, error) {
	client := &http.Client{Timeout: 30 * time.Second}
	var lastErr error

	for attempt := 1; attempt <= 3; attempt++ {
		if attempt > 1 {
			backoff := time.Duration(attempt*attempt) * time.Second
			fmt.Printf("  ⏳ Retry %d/3 in %v...\n", attempt, backoff)
			time.Sleep(backoff)
		}

		resp, err := client.Get(url)
		if err != nil {
			lastErr = err
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = err
			continue
		}

		if resp.StatusCode == http.StatusOK {
			return body, nil
		}
		lastErr = fmt.Errorf("iTunes API responded with %d", resp.StatusCode)
		if resp.StatusCode < 500 && resp.StatusCode != http.StatusTooManyRequests {
			return nil, lastErr
		}
	}

	return nil, lastErr
}

var sentenceRegex = regexp.MustCompile(`[^.!?]+[.!?]+`)

func splitSentences(text string) []string {
	var sentences []string
	for _, match := range sentenceRegex.FindAllString(text, -1) {
		trimmed := strings.TrimSpace(match)
		if trimmed != "" {
			sentences = append(sentences, trimmed)
		}
	}
	return sentences
}

func indexOf(slice []string, item string) int {
	for i, v := range slice {
		if v == item {
			return i
		}
	}
	return -1
}

func priceLabel(price float64) string {
	if price > 0 {
		return fmt.Sprintf("$%.2f", price)
	}
	return "Free"
}

// / liveFacts holds the fast-changing store facts a landing page renders. They
// / live in src/data/landing-live.json (Go-owned, regenerated every build) and
// / are overlaid on the slow-changing, hand-tuned src/data/landing-facts.json by
// / src/data/landing.ts, so a new App Store version never needs a manual commit.
type liveFacts struct {
	Version                   string  `json:"version"`
	Price                     string  `json:"price"`
	Rating                    float64 `json:"rating"`
	RatingCount               int     `json:"ratingCount"`
	ReleaseDate               string  `json:"releaseDate,omitempty"`
	CurrentVersionReleaseDate string  `json:"currentVersionReleaseDate,omitempty"`
	MinimumOsVersion          string  `json:"minimumOsVersion,omitempty"`
}

const liveLookupURL = "https://itunes.apple.com/lookup?id=%d&country=us"

// / refreshLiveFacts rewrites src/data/landing-live.json from a per-app iTunes
// / lookup for every live landing page. The per-app endpoint is used instead of
// / the developer-wide lookup behind apps.json because the latter is edge-cached
// / and lags real version bumps by days. Last-good values are preserved for any
// / app whose lookup fails, so a transient API hiccup never blanks the data.
func refreshLiveFacts() (int, error) {
	factsPath := filepath.Join("src", "data", "landing-facts.json")
	raw, err := os.ReadFile(factsPath)
	if err != nil {
		return 0, err
	}
	var facts struct {
		Apps []struct {
			TrackID int    `json:"trackId"`
			Status  string `json:"status"`
		} `json:"apps"`
	}
	if err := json.Unmarshal(raw, &facts); err != nil {
		return 0, err
	}

	livePath := filepath.Join("src", "data", "landing-live.json")
	live := map[string]liveFacts{}
	if existing, err := os.ReadFile(livePath); err == nil {
		_ = json.Unmarshal(existing, &live)
	}

	updated := 0
	for _, a := range facts.Apps {
		if a.Status != "live" {
			continue
		}
		it, err := lookupApp(a.TrackID)
		if err != nil {
			fmt.Printf("  ⚠️  keeping last-good facts for %d: %v\n", a.TrackID, err)
			continue
		}
		live[fmt.Sprintf("%d", a.TrackID)] = liveFacts{
			Version:                   it.Version,
			Price:                     priceLabel(it.Price),
			Rating:                    math.Round(it.AverageUserRating*100) / 100,
			RatingCount:               it.UserRatingCount,
			ReleaseDate:               it.ReleaseDate,
			CurrentVersionReleaseDate: it.CurrentVersionReleaseDate,
			MinimumOsVersion:          it.MinimumOsVersion,
		}
		updated++
	}

	out, err := json.MarshalIndent(live, "", "  ")
	if err != nil {
		return 0, err
	}
	if err := os.WriteFile(livePath, append(out, '\n'), 0644); err != nil {
		return 0, err
	}
	return updated, nil
}

// / lookupApp fetches a single app's current store metadata by track id.
func lookupApp(trackID int) (*iTunesApp, error) {
	body, err := getWithRetry(fmt.Sprintf(liveLookupURL, trackID))
	if err != nil {
		return nil, err
	}
	var resp iTunesResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}
	if len(resp.Results) == 0 {
		return nil, fmt.Errorf("no result for track id %d", trackID)
	}
	return &resp.Results[0], nil
}

// / canonicalStoreURL returns the bare US-storefront App Store link
// / (https://apps.apple.com/us/app/<slug>/id<n>) with every tracking parameter
// / (uo, mt, platform) stripped, so cards and landing pages link to a clean URL
// / instead of one Apple silently rewrites or that 404s on some devices.
func canonicalStoreURL(trackViewURL, slug string, trackID int) string {
	url := trackViewURL
	if url == "" {
		url = fmt.Sprintf("https://apps.apple.com/us/app/%s/id%d", slug, trackID)
	}
	url = strings.ReplaceAll(url, "https://apps.apple.com/app/", "https://apps.apple.com/us/app/")
	if i := strings.IndexByte(url, '?'); i != -1 {
		url = url[:i]
	}
	return url
}
