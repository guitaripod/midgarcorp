package appstore

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const (
	developerID = "1484270247"
	apiURL      = "https://itunes.apple.com/lookup?id=%s&entity=software&limit=200&country=us"
)

type iTunesResponse struct {
	Results []iTunesApp `json:"results"`
}

type iTunesApp struct {
	TrackID           int      `json:"trackId"`
	TrackName         string   `json:"trackName"`
	TrackViewURL      string   `json:"trackViewUrl"`
	Price             float64  `json:"price"`
	Description       string   `json:"description"`
	PrimaryGenreName  string   `json:"primaryGenreName"`
	ArtworkURL512     string   `json:"artworkUrl512"`
	ArtworkURL100     string   `json:"artworkUrl100"`
	Kind              string   `json:"kind"`
	ReleaseDate       string   `json:"releaseDate"`
	SupportedDevices  []string `json:"supportedDevices"`
	IPadScreenshotURLs []string `json:"ipadScreenshotUrls"`
	ScreenshotURLs    []string `json:"screenshotUrls"`
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

var appEnhancements = map[string]struct {
	ID           string
	Tagline      string
	PrimaryColor string
	Features     []string
}{
	"Solar Beam": {
		ID:           "solar-beam",
		Tagline:      "Your Window to the Universe",
		PrimaryColor: "#F59E0B",
		Features: []string{
			"Real-time space data",
			"Stunning 4K visualizations",
			"Educational astronomy content",
		},
	},
	"SForesight": {
		ID:           "sforesight",
		Tagline:      "ML-Powered SF Symbol Search",
		PrimaryColor: "#3B82F6",
		Features: []string{
			"ML-powered semantic search",
			"Instant symbol preview",
			"Export in multiple formats",
		},
	},
	"Double Kick": {
		ID:           "double-kick",
		Tagline:      "Understand Any Menu, Anywhere",
		PrimaryColor: "#DC2626",
		Features: []string{
			"Instant menu translation",
			"Dietary restriction alerts",
			"Cuisine insights",
		},
	},
	"Psywave": {
		ID:           "psywave",
		Tagline:      "AI-Powered Playlist Generation",
		PrimaryColor: "#8B5CF6",
		Features: []string{
			"ML-powered music analysis",
			"Mood-based playlist generation",
			"Apple Music integration",
		},
	},
	"Dream Eater": {
		ID:           "dream-eater",
		Tagline:      "ML-Powered Dream Journaling",
		PrimaryColor: "#6366F1",
		Features: []string{
			"Dream pattern analysis",
			"AI-powered insights",
			"Private & secure journaling",
		},
	},
	"Master of Inventory": {
		ID:           "master-of-inventory",
		Tagline:      "Professional Inventory Management",
		PrimaryColor: "#10B981",
		Features: []string{
			"Barcode scanning",
			"Multi-location tracking",
			"Detailed analytics",
		},
	},
	"Master of Flags": {
		ID:           "master-of-flags",
		Tagline:      "Learn World Flags",
		PrimaryColor: "#EF4444",
		Features: []string{
			"All country flags",
			"Interactive quizzes",
			"Progress tracking",
		},
	},
	"PixiePocket": {
		ID:           "pixiepocket",
		Tagline:      "AI Image Generator and Editor",
		PrimaryColor: "#3B82F6",
		Features: []string{
			"Chat-based interface for natural prompting",
			"Persistent cloud storage with public galleries",
			"Credit-based pricing with transparent costs",
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

	fmt.Println("✓ App Store data updated successfully")
	return nil
}

func fetchAppStoreData() ([]App, error) {
	url := fmt.Sprintf(apiURL, developerID)
	
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
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
	enhancement, hasEnhancement := appEnhancements[app.TrackName]
	
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
		cleanDesc = strings.Join(sentences[:2], ". ") + "."
	} else if len(sentences) == 1 {
		cleanDesc = sentences[0] + "."
	}

	// Ensure App Store URL uses US location
	appStoreURL := app.TrackViewURL
	if appStoreURL == "" {
		appStoreURL = fmt.Sprintf("https://apps.apple.com/us/app/%s/id%d", urlSlug, app.TrackID)
	}
	appStoreURL = strings.ReplaceAll(appStoreURL, "https://apps.apple.com/app/", "https://apps.apple.com/us/app/")

	// Map platforms
	platforms := mapDeviceTosPlatform(app)
	
	// Add platform parameter for iOS apps
	if contains(platforms, "iPhone") || contains(platforms, "iPad") {
		if !strings.Contains(appStoreURL, "?") {
			appStoreURL += "?platform=iphone"
		} else if !strings.Contains(appStoreURL, "platform=") {
			appStoreURL += "&platform=iphone"
		}
	}

	// Determine price
	price := "Free"
	if app.Price > 0 {
		price = fmt.Sprintf("$%.2f", app.Price)
	}

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

// Helper functions
func splitSentences(text string) []string {
	var sentences []string
	
	// Split by sentence terminators
	parts := strings.FieldsFunc(text, func(r rune) bool {
		return r == '.' || r == '!' || r == '?'
	})
	
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
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

func contains(slice []string, item string) bool {
	return indexOf(slice, item) != -1
}