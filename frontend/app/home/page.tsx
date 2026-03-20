"use client";

import { useCallback, useEffect, useState } from "react";

const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || "";

export default function Home() {
  const [token, setToken] = useState<string | null>(() => {
    // Next.js pre-renders on the server where window/localStorage don't exist.
    // Guard ensures we only access localStorage in the browser.
    if (typeof window !== "undefined") {
      return localStorage.getItem("github_token");
    }
    return null;
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.has("code");
    }
    return false;
  });

  const exchangeToken = useCallback(async (code: string) => {
    try {
      const res = await fetch(`/api/github/callback?code=${code}`);
      const data = await res.json();
      if (data.access_token) {
        localStorage.setItem("github_token", data.access_token);
        setToken(data.access_token);
        window.history.replaceState({}, "", "/home");
      }
    } catch (err) {
      console.error("Token exchange failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      exchangeToken(code);
    }
  }, [token, exchangeToken]);

  const handleLogin = () => {
    const redirectUri = `${window.location.origin}/home`;
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=repo`;
  };

  const handleLogout = () => {
    localStorage.removeItem("github_token");
    setToken(null);
    setCommits([]);
    setRepo("");
  };

  const [apiKey, setApiKey] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("api_key") || "";
    }
    return "";
  });

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    localStorage.setItem("api_key", value);
  };

  const [repo, setRepo] = useState("");
  
  const [commits, setCommits] = useState<
    { sha: string; message: string; author: string; date: string; files: string[]; summary: string }[]
  >([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!repo.trim() || !token) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/github/commits?repo=${encodeURIComponent(repo)}`, {
        headers: { Authorization: `Bearer ${token}`},
      });
      if (!res.ok) throw new Error("Failed to fetch commits");
      const data = await res.json();
      setCommits(data.commits.map((c: { sha: string; message: string; author: string; date: string; files: string[] }) => ({ ...c, summary: "" })));
    } catch (err) {
      console.error("Search failed:", err);
      setCommits([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSummarize = async (sha: string) => {
    const commit = commits.find((c) => c.sha === sha);
    if (!commit) return;
    setCommits((prev) => prev.map((c) => c.sha === sha ? { ...c, summary: "Summarizing..." } : c));
    try {
      const res = await fetch("/api/github/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({
          message: commit.message,
          author: commit.author,
          date: commit.date,
          files: commit.files,
        }),
      });
      const data = await res.json();
      setCommits((prev) => prev.map((c) => c.sha === sha ? { ...c, summary: data.summary } : c));
    } catch {
      setCommits((prev) => prev.map((c) => c.sha === sha ? { ...c, summary: "Failed to summarize." } : c));
    }
  };

  if (loading) {
    return (
      <main className="p-8 font-sans">
        <p className="text-gray-500">Authenticating with GitHub...</p>
      </main>
    );
  }

  return (
    <main className="font-sans">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="w-32" />
        <h1 className="text-xl font-bold">GitHub Commit Search</h1>
        
        <div className="w-32 flex justify-end">
          {!token ? (
            <button
              onClick={handleLogin}
              className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition"
            >
              Login
            </button>
          ) : (
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition"
            >
              Logout
            </button>
          )}
        </div>
      </nav>

      <div className="p-8">
        {token && (
          <>
            <div className="flex items-center gap-4 mb-4">
              <label className="text-sm font-medium">x_api_key for summarizer:</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="Enter API key"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex items-center gap-4">
              <input
                type="text"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="owner/repo"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
              >
                {searching ? "Searching..." : "Search Repository"}
              </button>
            </div>

            {commits.length > 0 && (
              <div className="mt-6 flex flex-col gap-3">
                {commits.map((c) => (
                  <div key={c.sha} className="p-4 border border-gray-200 rounded-lg flex gap-4">
                    {/* Left — Commit details */}
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <p className="font-medium">{c.message}</p>
                        <code className="text-xs text-blue-600 ml-2 shrink-0">{c.sha.slice(0, 7)}</code>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {c.author} — {new Date(c.date).toLocaleDateString()}
                      </p>
                      {c.files.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-400 mb-1">Files changed:</p>
                          <ul className="text-sm text-gray-600">
                            {c.files.map((f) => (
                              <li key={f} className="font-mono text-xs">{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Right — Summary */}
                    <div className="flex-1 border-l border-gray-200 pl-4">
                      {!c.summary ? (
                        <button
                          onClick={() => handleSummarize(c.sha)}
                          className="mb-2 px-4 py-1 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition"
                        >
                          Summarize
                        </button>
                      ) : c.summary === "Summarizing..." ? (
                        <p className="text-sm text-gray-500">Summarizing...</p>
                      ) : (
                        <p className="text-sm text-gray-700">{c.summary}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
