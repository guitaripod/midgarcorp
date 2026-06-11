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

	// Generate OG images (still using Node.js scripts for now)
	fmt.Println("Generating OG images...")
	for _, script := range []string{
		"scripts/generate-main-og-image.js",
		"scripts/generate-apps-og-grid.js",
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
