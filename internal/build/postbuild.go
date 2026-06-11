package build

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

func PostBuild() error {
	fmt.Println("Running post-build optimizations...")

	// Run Pagefind
	fmt.Println("Building search index with Pagefind...")
	cmd := exec.Command("npx", "pagefind", "--source", "dist")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		fmt.Printf("Failed to build search index: %v\n", err.Error())
	} else {
		fmt.Println("✓ Search index built successfully")
	}

	// Check if performance budget script exists
	perfBudgetScript := filepath.Join("scripts", "performance-budget.js")
	if _, err := os.Stat(perfBudgetScript); err == nil {
		fmt.Println("Checking performance budget...")
		cmd := exec.Command("node", perfBudgetScript)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			fmt.Printf("Performance budget check failed: %v\n", err.Error())
		}
	}

	fmt.Println("✓ Post-build optimizations complete")
	return nil
}
