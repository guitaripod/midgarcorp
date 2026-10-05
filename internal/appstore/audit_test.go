package appstore

import "testing"

func TestPlatformClass(t *testing.T) {
	cases := []struct {
		name      string
		platforms []string
		want      string
	}{
		{"iPhone only", []string{"iPhone"}, "iOS"},
		{"iPhone with watch companion", []string{"iPhone", "Apple Watch", "Mac", "Linux"}, "iOS"},
		{"universal with TV and Mac", []string{"iPhone", "iPad", "Mac", "Apple TV", "Vision Pro"}, "iOS"},
		{"Mac only", []string{"Mac"}, "macOS"},
		{"TV only", []string{"Apple TV"}, "tvOS"},
		{"Watch only", []string{"Apple Watch"}, "watchOS"},
		{"empty", nil, "iOS"},
	}
	for _, c := range cases {
		if got := platformClass(c.platforms); got != c.want {
			t.Errorf("%s: platformClass(%v) = %s, want %s", c.name, c.platforms, got, c.want)
		}
	}
}

func TestLiveStorePlatformClass(t *testing.T) {
	cases := []struct {
		name string
		app  iTunesApp
		want string
	}{
		{"iPhone app that also runs on Mac", iTunesApp{Kind: "software", SupportedDevices: []string{"MacDesktop-MacDesktop", "iPhone5s-iPhone5s"}}, "iOS"},
		{"iPhone app with watch companion", iTunesApp{Kind: "software", SupportedDevices: []string{"Watch6-Watch6", "iPhone16-iPhone16"}}, "iOS"},
		{"Mac-only device list", iTunesApp{Kind: "software", SupportedDevices: []string{"MacDesktop-MacDesktop"}}, "macOS"},
		{"Mac software", iTunesApp{Kind: "mac-software"}, "macOS"},
		{"Apple TV only", iTunesApp{Kind: "software", SupportedDevices: []string{"AppleTV-AppleTV"}}, "tvOS"},
		{"no device list falls back to screenshots", iTunesApp{Kind: "software", ScreenshotURLs: []string{"x"}}, "iOS"},
	}
	for _, c := range cases {
		if got := liveStorePlatformClass(c.app); got != c.want {
			t.Errorf("%s: liveStorePlatformClass = %s, want %s", c.name, got, c.want)
		}
	}
}
