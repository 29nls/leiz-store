// Client-side auth helper functions
export async function login(username: string, password: string): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const response = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Store user info in localStorage for client-side access
      if (data.data?.user) {
        localStorage.setItem("admin_user", JSON.stringify(data.data.user));
      }
      return { success: true, user: data.data.user };
    } else {
      return { success: false, error: data.error || "Login failed" };
    }
  } catch (error) {
    return { success: false, error: "Network error" };
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch("/api/admin/auth/logout", { method: "POST" });
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    // Clear client-side storage
    localStorage.removeItem("admin_user");
  }
}

export async function getCurrentUser(): Promise<any | null> {
  try {
    // Try localStorage first for faster access
    const cached = localStorage.getItem("admin_user");
    if (cached) {
      // Verify with server
      const response = await fetch("/api/admin/auth/me");
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.user) {
          localStorage.setItem("admin_user", JSON.stringify(data.data.user));
          return data.data.user;
        }
      }
    }

    // Not cached or verification failed
    localStorage.removeItem("admin_user");
    return null;
  } catch (error) {
    localStorage.removeItem("admin_user");
    return null;
  }
}

export function getAuthUser(): any | null {
  if (typeof window === "undefined") return null;

  const userStr = localStorage.getItem("admin_user");
  if (!userStr) return null;

  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}
