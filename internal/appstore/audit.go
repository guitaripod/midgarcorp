package appstore

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type auditApp struct {
	Slug        string   `json:"slug"`
	TrackID     int      `json:"trackId"`
	Status      string   `json:"status"`
	Category    string   `json:"category"`
	Price       string   `json:"price"`
	Description string   `json:"description"`
	Platforms   []string `json:"platforms"`
}

type drift struct {
	field      string
	committed  string
	live       string
	structural bool
}

// / AuditStore compares the committed landing-facts.json against the live,
// / per-app App Store listing and reports fields that have drifted but do NOT
// / self-heal at build time. Version, rating, and release dates are ignored
// / because landing-live.json refreshes those every build.
// /
// / Structural drift (platform class, category, price) marks a repositioning —
// / e.g. a paid Apple TV app becoming a free Mac app — and exits non-zero so the
// / daily cron goes red and notifies. Description drift is reported and
// / annotated but does not fail the run, since store copy is tweaked often.
func AuditStore() error {
	path := filepath.Join("src", "data", "landing-facts.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var doc struct {
		Apps []auditApp `json:"apps"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		return err
	}

	annotate := os.Getenv("GITHUB_ACTIONS") == "true"
	checked, structural, minor, unverified := 0, 0, 0, 0

	fmt.Println("Auditing committed landing facts against the live App Store...")
	fmt.Println()

	for _, a := range doc.Apps {
		if a.Status != "live" {
			continue
		}
		checked++

		it, err := lookupApp(a.TrackID)
		if err != nil {
			unverified++
			fmt.Printf("  ? %-20s could not verify (%v)\n", a.Slug, err)
			continue
		}

		drifts := diffStoreFacts(a, it)
		if len(drifts) == 0 {
			fmt.Printf("  ✓ %-20s in sync\n", a.Slug)
			continue
		}

		hasStructural := anyStructural(drifts)
		if hasStructural {
			structural++
			fmt.Printf("  ⚠ %-20s needs attention:\n", a.Slug)
		} else {
			minor++
			fmt.Printf("  · %-20s minor drift:\n", a.Slug)
		}
		for _, d := range drifts {
			tag := "copy"
			if d.structural {
				tag = "PIVOT"
			}
			fmt.Printf("      [%-5s] %-12s %s  →  %s\n", tag, d.field, d.committed, d.live)
		}
		if annotate {
			level := "warning"
			if hasStructural {
				level = "error"
			}
			fmt.Printf("::%s title=Store drift::%s: %s\n", level, a.Slug, summarizeDrift(drifts))
		}
	}

	fmt.Println()
	fmt.Printf("Checked %d live app(s): %d in sync, %d need attention, %d minor, %d unverified.\n",
		checked, checked-structural-minor-unverified, structural, minor, unverified)

	if structural > 0 {
		return fmt.Errorf("%d app(s) drifted structurally from the live App Store — refresh facts with scripts/fetch-store-assets.py and re-tune the landing copy", structural)
	}
	return nil
}

func diffStoreFacts(a auditApp, it *iTunesApp) []drift {
	var out []drift

	committedClass := platformClass(a.Platforms)
	liveClass := platformClass(mapDeviceTosPlatform(*it))
	if committedClass != liveClass {
		out = append(out, drift{"platform", committedClass, liveClass, true})
	}

	if !strings.EqualFold(strings.TrimSpace(a.Category), strings.TrimSpace(it.PrimaryGenreName)) {
		out = append(out, drift{"category", a.Category, it.PrimaryGenreName, true})
	}

	livePrice := priceLabel(it.Price)
	if a.Price != livePrice {
		out = append(out, drift{"price", a.Price, livePrice, true})
	}

	committedHook := firstSentence(a.Description)
	liveHook := firstSentence(it.Description)
	if normalizeText(committedHook) != normalizeText(liveHook) {
		out = append(out, drift{"description", clipRunes(committedHook, 40), clipRunes(liveHook, 40), false})
	}

	return out
}

func anyStructural(drifts []drift) bool {
	for _, d := range drifts {
		if d.structural {
			return true
		}
	}
	return false
}

// / platformClass collapses a device list to the OS family that defines the
// / listing, so an iPhone app that merely runs on iPad (or carries iPad
// / screenshots) doesn't read as a platform change — only an iOS↔macOS↔tvOS move
// / does.
func platformClass(platforms []string) string {
	for _, p := range platforms {
		switch {
		case strings.Contains(p, "Mac"):
			return "macOS"
		case strings.Contains(p, "TV"):
			return "tvOS"
		case strings.Contains(p, "Watch"):
			return "watchOS"
		}
	}
	return "iOS"
}

func firstSentence(text string) string {
	if sentences := splitSentences(text); len(sentences) > 0 {
		return sentences[0]
	}
	return strings.TrimSpace(text)
}

// / normalizeText lowercases and keeps only alphanumerics and single spaces, so
// / cosmetic punctuation tweaks don't register as a description change.
func normalizeText(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(s) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == ' ':
			b.WriteRune(' ')
		}
	}
	return strings.Join(strings.Fields(b.String()), " ")
}

func clipRunes(s string, n int) string {
	s = strings.TrimSpace(s)
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n]) + "…"
}

func summarizeDrift(drifts []drift) string {
	parts := make([]string, len(drifts))
	for i, d := range drifts {
		parts[i] = fmt.Sprintf("%s %s→%s", d.field, d.committed, d.live)
	}
	return strings.Join(parts, "; ")
}
