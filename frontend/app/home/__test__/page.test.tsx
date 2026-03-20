import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import Home from "../page";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock fetch
global.fetch = jest.fn();

beforeEach(() => {
  localStorageMock.clear();
  jest.clearAllMocks();
});

describe("Home", () => {
  it("shows login button when no token", () => {
    render(<Home />);
    expect(screen.getByText("Login")).toBeInTheDocument();
  });

  it("shows search input when token exists", () => {
    localStorageMock.setItem("github_token", "fake-token");
    render(<Home />);
    expect(screen.getByPlaceholderText("owner/repo")).toBeInTheDocument();
  });

  it("shows logout button when logged in", () => {
    localStorageMock.setItem("github_token", "fake-token");
    render(<Home />);
    expect(screen.getByText("Logout")).toBeInTheDocument();
  });

  it("clears token on logout", () => {
    localStorageMock.setItem("github_token", "fake-token");
    render(<Home />);
    fireEvent.click(screen.getByText("Logout"));
    expect(localStorageMock.getItem("github_token")).toBeNull();
  });

  it("fetches commits on search", async () => {
    localStorageMock.setItem("github_token", "fake-token");
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        commits: [
          {
            sha: "abc123",
            message: "fix bug",
            author: "dev",
            date: "2026-01-01",
            files: ["index.ts"],
          },
        ],
      }),
    });

    render(<Home />);
    fireEvent.change(screen.getByPlaceholderText("owner/repo"), {
      target: { value: "user/repo" },
    });
    fireEvent.click(screen.getByText("Search Repository"));

    expect(fetch).toHaveBeenCalledWith(
      "/api/github/commits?repo=user%2Frepo",
      expect.objectContaining({
        headers: { Authorization: "Bearer fake-token" },
      })
    );
  });
});
