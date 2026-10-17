package build

import (
	"fmt"
	"os/exec"

	"github.com/guitaripod/midgarcorp/internal/appstore"
	"github.com/guitaripod/midgarcorp/internal/github"
)

func PreBuild() error {
	fmt.Println("Running pre-build tasks...")

	// Fetch latest app store data
	if err := appstore.FetchData(); err != nil {
		fmt.Printf("Failed to fetch App Store data: %v\n", err.Error())
		// Don't fail the build if App Store fetch fails
	}

	// Fetch latest GitHub data
	if err := github.FetchData(); err != nil {
		fmt.Printf("Failed to fetch GitHub data: %v\n", err.Error())
		// Don't fail the build if GitHub fetch fails
	}

	// Live-data snapshots and OG images (still using Node.js scripts for now)
	fmt.Println("Refreshing snapshots and generating OG images...")
	for _, script := range []string{
		"scripts/fetch-github-activity.mjs",
		"scripts/fetch-app-work.mjs",
		"scripts/fetch-webb-live.mjs",
		"scripts/fetch-blackwall.mjs",
		"scripts/generate-screenshot-variants.mjs",
		"scripts/generate-main-og-image.js",
		"scripts/generate-apps-og-grid.js",
		"scripts/generate-app-og.js",
		"scripts/generate-linux-og.js",
		"scripts/generate-page-og.js",
		"scripts/generate-recview-og.js",
		"scripts/generate-blackwall-og.js",
	} {
		cmd := exec.Command("node", script)
		cmd.Stdout = nil // Hide output since it's handled by the script
		cmd.Stderr = nil
		if err := cmd.Run(); err != nil {
			fmt.Printf("Failed to run %s: %v\n", script, err.Error())
			// Don't fail the build if OG image generation fails
		} else {
			fmt.Printf("✓ %s completed\n", script)
		}
	}

	fmt.Println("✓ Pre-build tasks complete")
	return nil
}
