package appstore

import (
	"slices"
	"testing"
)

func TestSplitSentences(t *testing.T) {
	cases := []struct {
		name string
		text string
		want []string
	}{
		{"two sentences", "Flags and capitals. Learn them all!", []string{"Flags and capitals.", "Learn them all!"}},
		{"abbreviation inside a word", "You wake at 3 a.m. The dream fades.", []string{"You wake at 3 a.m.", "The dream fades."}},
		{"abbreviation before a lowercase word", "Wake at 3 a.m. and speak. Then sleep.", []string{"Wake at 3 a.m. and speak.", "Then sleep."}},
		{"dotted brand name", "Synced lyrics and Last.fm scrobbling. Gapless too.", []string{"Synced lyrics and Last.fm scrobbling.", "Gapless too."}},
		{"closing quote after the terminator", `It says "hello." Then it waits.`, []string{`It says "hello."`, "Then it waits."}},
		{"repeated terminators", "Really?! Yes...", []string{"Really?!", "Yes..."}},
		{"bullet list after a terminator", "Track your habits.\n• Fast sync.\n• Simple.", []string{"Track your habits.", "• Fast sync.", "• Simple."}},
		{"line break before a lowercase line", "Ends here.\nlowercase start.", []string{"Ends here.", "lowercase start."}},
		{"trailing fragment without a terminator", "One sentence. A fragment", []string{"One sentence."}},
		{"empty", "", nil},
	}
	for _, c := range cases {
		if got := splitSentences(c.text); !slices.Equal(got, c.want) {
			t.Errorf("%s: splitSentences(%q) = %q, want %q", c.name, c.text, got, c.want)
		}
	}
}

func TestMapDeviceTosPlatform(t *testing.T) {
	cases := []struct {
		name string
		app  iTunesApp
		want []string
	}{
		{"iPhone app that also runs on iPad", iTunesApp{SupportedDevices: []string{"iPhone17-iPhone17", "iPadAir4-iPadAir4"}}, []string{"iPhone", "iPad"}},
		{"universal purchase with Mac and Watch", iTunesApp{SupportedDevices: []string{"MacDesktop-MacDesktop", "Watch4-Watch4", "iPadPro-iPadPro", "iPhone16-iPhone16"}}, []string{"iPhone", "iPad", "Mac", "Apple Watch"}},
		{"Apple TV record", iTunesApp{SupportedDevices: []string{"AppleTV4K-AppleTV4K"}}, []string{"Apple TV"}},
		{"Mac record", iTunesApp{Kind: "mac-software", SupportedDevices: []string{"MacDesktop-MacDesktop"}}, []string{"Mac"}},
		{"no devices, screenshots only", iTunesApp{ScreenshotURLs: []string{"a.png"}}, []string{"iPhone"}},
		{"nothing known", iTunesApp{}, []string{"iPhone", "iPad"}},
	}
	for _, c := range cases {
		if got := mapDeviceTosPlatform(c.app); !slices.Equal(got, c.want) {
			t.Errorf("%s: mapDeviceTosPlatform = %v, want %v", c.name, got, c.want)
		}
	}
}
