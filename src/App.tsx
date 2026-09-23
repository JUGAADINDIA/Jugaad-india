import { useEffect, useMemo, useState } from "react";
import { createClient, User } from "@supabase/supabase-js";
import "./App.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string | null;
  preferred_language: string | null;
  preferred_address: string | null;
  service_area: string | null;
  latitude: number | null;
  longitude: number | null;
  is_verified: boolean | null;
  is_active: boolean | null;
  rating: number | null;
  completed_job: number | null;
};

type RequestRow = {
  id: string;
  user_id?: string | null;
  need?: string | null;
  category?: string | null;
  location?: string | null;
  status?: string | null;
  provider_id?: string | null;
  created_at?: string | null;
  create_at?: string | null;
};

type MatchRow = {
  id: string;
  request_id: string;
  worker_id?: string | null;
  provider_id?: string | null;
  quoted_amount?: number | null;
  distance_km?: number | null;
  status?: string | null;
  matches_status?: string | null;
  created_at?: string | null;
};

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type?: string | null;
  request_id?: string | null;
  match_id?: string | null;
  is_read: boolean;
  created_at: string;
};

const STATUS = {
  pending: "pending",
  accepted: "accepted",
  in_progress: "in_progress",
  completed: "completed",
  cancelled: "cancelled",
};

const categories = [
  "Sab",
  "Home",
  "Repair",
  "Delivery",
  "Personal",
  "Business",
];

const services = [
  "Electrician",
  "Plumber",
  "Mobile Repair",
  "AC/Cooler Repair",
  "Home Cleaning",
  "Delivery Help",
];

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status?: string | null) {
  switch (status) {
    case "pending":
      return "⏳ Pending";
    case "accepted":
      return "🤝 Accepted";
    case "in_progress":
      return "🚗 Kaam chal raha";
    case "completed":
      return "✅ Completed";
    case "cancelled":
      return "❌ Cancelled";
    default:
      return status || "Unknown";
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState("home");
  const [category, setCategory] = useState("Sab");
  const [need, setNeed] = useState("");
  const [location, setLocation] = useState("");
  const [savingRequest, setSavingRequest] = useState(false);

  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  const [showNotifications, setShowNotifications] = useState(false);
  const [message, setMessage] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const role = String(profile?.role || "customer").toLowerCase();

  const isAdmin =
    role === "admin" ||
    role === "super_admin";

  const isProvider =
    role === "provider" ||
    role === "worker" ||
    role === "service_provider";

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (!user) return;

    loadProfile(user.id);
    loadNotifications(user.id);
  }, [user]);

  useEffect(() => {
    if (!user || !profile) return;

    if (isAdmin) {
      loadAdminData();
    } else {
      loadRequests();
      loadMatches();
    }
  }, [user, profile]);

  async function init() {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    setUser(session?.user ?? null);
    setLoading(false);

    supabase.auth.onAuthStateChange((_event, newSession) => {
      setUser(newSession?.user ?? null);
    });
  }

  async function login() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setMessage(error.message);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setRequests([]);
    setMatches([]);
    setNotifications([]);
  }

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error(error);
      return;
    }

    setProfile(data);
    setProfileName(data?.full_name || "");
    setProfilePhone(data?.phone || "");
    setProfileAddress(data?.preferred_address || "");
  }

  async function loadRequests() {
    if (!user || !profile) return;

    let query = supabase
      .from("requests")
      .select("*");

    if (isProvider) {
      query = query.in("status", [
        STATUS.pending,
        STATUS.accepted,
        STATUS.in_progress,
      ]);
    } else {
      query = query.eq("user_id", user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error(error);
      return;
    }

    const sorted = (data || []).sort((a, b) => {
      const ad = new Date(
        a.created_at || a.create_at || 0
      ).getTime();

      const bd = new Date(
        b.created_at || b.create_at || 0
      ).getTime();

      return bd - ad;
    });

    setRequests(sorted);
  }

  async function loadMatches() {
    if (!user) return;

    const { data, error } = await supabase
      .from("matches")
      .select("*");

    if (error) {
      console.error(error);
      return;
    }

    setMatches(data || []);
  }

  async function loadNotifications(userId: string) {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setNotifications(data || []);
  }

  async function loadAdminData() {
    await Promise.all([
      loadRequests(),
      loadMatches(),
    ]);
  }

  async function createRequest() {
    if (!user) {
      setMessage("Pehle Google se login karo 😄");
      return;
    }

    const cleanNeed = need.trim();

    if (!cleanNeed) {
      setMessage("Bhai, pehle batao kya jugaad chahiye 😄");
      return;
    }

    setSavingRequest(true);
    setMessage("");

    const { error } = await supabase
      .from("requests")
      .insert({
        user_id: user.id,
        need: cleanNeed,
        category: category === "Sab" ? null : category,
        location:
          location.trim() ||
          profile?.preferred_address ||
          null,
        status: STATUS.pending,
      });

    setSavingRequest(false);

    if (error) {
      console.error(error);
      setMessage(error.message);
      return;
    }

    setNeed("");
    setLocation("");
    setCategory("Sab");
    setMessage("🎉 JUGAAD nikal pada! Kaam dhoondh raha hai.");

    await loadRequests();
    setTab("requests");
  }

  async function acceptRequest(requestId: string) {
    if (!user) return;

    setMessage("");

    const { data: existing, error: matchError } = await supabase
      .from("matches")
      .select("id")
      .eq("request_id", requestId)
      .eq("provider_id", user.id)
      .maybeSingle();

    if (matchError) {
      setMessage(matchError.message);
      return;
    }

    if (!existing) {
      const { error } = await supabase
        .from("matches")
        .insert({
          request_id: requestId,
          provider_id: user.id,
          worker_id: user.id,
          status: "accepted",
        });

      if (error) {
        console.error(error);
        setMessage("Match create nahi hua: " + error.message);
        return;
      }
    }

    const { error: requestError } = await supabase
      .from("requests")
      .update({
        status: STATUS.accepted,
        provider_id: user.id,
      })
      .eq("id", requestId);

    if (requestError) {
      setMessage(requestError.message);
      return;
    }

    setMessage("🔥 Kaam pakad liya! Customer ko bata diya.");
    await loadRequests();
    await loadMatches();
  }

  async function updateRequestStatus(
    requestId: string,
    status: string
  ) {
    const { error } = await supabase
      .from("requests")
      .update({ status })
      .eq("id", requestId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      status === STATUS.completed
        ? "🎉 Kaam complete! JUGAAD successful."
        : "Status update ho gaya 👍"
    );

    await loadRequests();
  }

  async function saveProfile() {
    if (!user) return;

    setSavingProfile(true);
    setMessage("");

    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        full_name: profileName.trim() || null,
        phone: profilePhone.trim() || null,
        preferred_address:
          profileAddress.trim() || null,
      });

    setSavingProfile(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadProfile(user.id);
    setMessage("💾 Profile save ho gaya.");
  }

  async function switchToProvider() {
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        role: "provider",
        is_active: true,
      });

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadProfile(user.id);
    setTab("home");
    setMessage("🧰 Provider mode ON! Ab kaam pakdo.");
  }

  async function switchToCustomer() {
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        role: "customer",
      });

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadProfile(user.id);
    setTab("home");
    setMessage("🧑 Customer mode ON!");
  }

  async function markNotificationRead(id: string) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    if (error) {
      console.error(error);
      return;
    }

    if (user) {
      await loadNotifications(user.id);
    }
  }

  async function markAllNotificationsRead() {
    if (!user) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadNotifications(user.id);
  }

  const customerRequests = useMemo(() => {
    if (!user) return [];

    return requests.filter(
      (r) => r.user_id === user.id
    );
  }, [requests, user]);

  const providerRequests = useMemo(() => {
    return requests;
  }, [requests]);

  const adminStats = {
    users: 0,
    requests: requests.length,
    matches: matches.length,
    notifications: notifications.length,
  };

  if (loading) {
    return (
      <div className="loadingScreen">
        <div className="mascot">💡😎</div>
        <h2>JUGAAD lag raha hai...</h2>
        <p>Thoda ruk bhai, jugaad start ho raha hai 😄</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="loginScreen">
        <div className="logoBox">💡😎</div>

        <h1>JUGAAD</h1>

        <p className="tagline">
          Har zarurat ka jugaad 🇮🇳
        </p>

        <h2>Jo chahiye, JUGAAD se milega</h2>

        <p>
          Gaon ho ya metro, kaam chhota ho ya bada —
          JUGAAD dekhega kya karna hai. 😎
        </p>

        <button
          className="primaryButton bigButton"
          onClick={login}
        >
          Google se Login 🚀
        </button>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="adminShell">
        <aside className="adminSidebar">
          <div className="adminLogo">
            💡😎
            <span>JUGAAD</span>
          </div>

          <div className="adminTitle">
            Admin Dashboard
          </div>

          <button
            className="sideButton active"
            onClick={() => setTab("admin")}
          >
            📊 Dashboard
          </button>

          <button
            className="sideButton"
            onClick={() => setTab("adminRequests")}
          >
            📋 Requests
          </button>

          <button
            className="sideButton"
            onClick={() => setTab("adminMatches")}
          >
            🤝 Matches
          </button>

          <button
            className="sideButton"
            onClick={() => setTab("adminNotifications")}
          >
            🔔 Notifications
          </button>

          <div className="sidebarBottom">
            <button
              className="logoutButton"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </aside>

        <main className="adminMain">
          <div className="adminTopbar">
            <div>
              <h1>
                {tab === "admin"
                  ? "Dashboard"
                  : tab === "adminRequests"
                  ? "Requests"
                  : tab === "adminMatches"
                  ? "Matches"
                  : "Notifications"}
              </h1>

              <p>
                JUGAAD control room 😎
              </p>
            </div>

            <div className="adminUser">
              <div className="avatar">
                👨‍💼
              </div>

              <div>
                <b>
                  {profile?.full_name ||
                    user.email ||
                    "Admin"}
                </b>
                <small>Administrator</small>
              </div>
            </div>
          </div>

          {message && (
            <div className="messageBox">
              {message}
            </div>
          )}

          {tab === "admin" && (
            <>
              <div className="statsGrid">
                <div className="statCard">
                  <span>👥</span>
                  <small>Users</small>
                  <strong>
                    {adminStats.users}
                  </strong>
                </div>

                <div className="statCard">
                  <span>📋</span>
                  <small>Requests</small>
                  <strong>
                    {adminStats.requests}
                  </strong>
                </div>

                <div className="statCard">
                  <span>🤝</span>
                  <small>Matches</small>
                  <strong>
                    {adminStats.matches}
                  </strong>
                </div>

                <div className="statCard">
                  <span>🔔</span>
                  <small>Notifications</small>
                  <strong>
                    {adminStats.notifications}
                  </strong>
                </div>
              </div>

              <section className="adminPanel">
                <div className="panelHeader">
                  <div>
                    <h2>Recent Requests</h2>
                    <p>Latest customer requirements</p>
                  </div>

                  <button
                    onClick={() =>
                      setTab("adminRequests")
                    }
                  >
                    Sab dekho →
                  </button>
                </div>

                {requests.length === 0 ? (
                  <div className="emptyState">
                    📭 Abhi koi request nahi.
                  </div>
                ) : (
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Need</th>
                          <th>Category</th>
                          <th>Location</th>
                          <th>Status</th>
                          <th>Date</th>
                        </tr>
                      </thead>

                      <tbody>
                        {requests
                          .slice(0, 10)
                          .map((request) => (
                            <tr key={request.id}>
                              <td>
                                <b>
                                  {request.need ||
                                    "No description"}
                                </b>
                              </td>

                              <td>
                                {request.category ||
                                  "General"}
                              </td>

                              <td>
                                {request.location ||
                                  "Not provided"}
                              </td>

                              <td>
                                <span className="statusPill">
                                  {statusLabel(
                                    request.status
                                  )}
                                </span>
                              </td>

                              <td>
                                {formatDate(
                                  request.created_at ||
                                    request.create_at
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {tab === "adminRequests" && (
            <section className="adminPanel">
              <div className="panelHeader">
                <div>
                  <h2>All Requests</h2>
                  <p>
                    Customer ki sari requirements
                  </p>
                </div>
              </div>

              {requests.length === 0 ? (
                <div className="emptyState">
                  📭 Koi request nahi.
                </div>
              ) : (
                <div className="requestAdminGrid">
                  {requests.map((request) => (
                    <div
                      className="adminRequestCard"
                      key={request.id}
                    >
                      <div className="cardTop">
                        <span className="categoryTag">
                          {request.category ||
                            "General"}
                        </span>

                        <span className="statusPill">
                          {statusLabel(
                            request.status
                          )}
                        </span>
                      </div>

                      <h3>
                        {request.need ||
                          "Customer requirement"}
                      </h3>

                      <p>
                        📍{" "}
                        {request.location ||
                          "Location not given"}
                      </p>

                      <small>
                        {formatDate(
                          request.created_at ||
                            request.create_at
                        )}
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === "adminMatches" && (
            <section className="adminPanel">
              <div className="panelHeader">
                <div>
                  <h2>Active Matches</h2>
                  <p>
                    Customer aur provider connections
                  </p>
                </div>
              </div>

              {matches.length === 0 ? (
                <div className="emptyState">
                  🤝 Abhi koi match nahi.
                </div>
              ) : (
                <div className="requestAdminGrid">
                  {matches.map((match) => (
                    <div
                      className="adminRequestCard"
                      key={match.id}
                    >
                      <h3>
                        🤝 Match
                      </h3>

                      <p>
                        Request ID:
                        <br />
                        {match.request_id}
                      </p>

                      <p>
                        Provider:
                        <br />
                        {match.provider_id ||
                          match.worker_id ||
                          "Not assigned"}
                      </p>

                      <span className="statusPill">
                        {match.status ||
                          match.matches_status ||
                          "accepted"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === "adminNotifications" && (
            <section className="adminPanel">
              <div className="panelHeader">
                <div>
                  <h2>Notifications</h2>
                  <p>
                    JUGAAD activity alerts
                  </p>
                </div>

                {unreadCount > 0 && (
                  <button
                    onClick={
                      markAllNotificationsRead
                    }
                  >
                    Sab read ✓
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="emptyState">
                  🔕 Abhi notification nahi.
                </div>
              ) : (
                <div className="notificationList">
                  {notifications.map((n) => (
                    <div
                      className={
                        n.is_read
                          ? "notification read"
                          : "notification"
                      }
                      key={n.id}
                      onClick={() =>
                        markNotificationRead(n.id)
                      }
                    >
                      <div className="notificationIcon">
                        🔔
                      </div>

                      <div>
                        <b>{n.title}</b>
                        <p>{n.message}</p>
                        <small>
                          {formatDate(n.created_at)}
                        </small>
                      </div>

                      {!n.is_read && (
                        <span className="newDot">
                          NEW
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="appShell">
      <header className="topbar">
        <div className="brand">
          <div className="brandMascot">
            💡😎
          </div>

          <div>
            <h1>JUGAAD</h1>
            <small>
              Har zarurat ka jugaad 🇮🇳
            </small>
          </div>
        </div>

        <div className="topActions">
          <button
            className="notificationButton"
            onClick={() =>
              setShowNotifications(
                !showNotifications
              )
            }
          >
            🔔
            {unreadCount > 0 && (
              <span>{unreadCount}</span>
            )}
          </button>
        </div>
      </header>

      {showNotifications && (
        <div className="notificationDropdown">
          <div className="notificationHead">
            <h3>Notifications 🔔</h3>

            {unreadCount > 0 && (
              <button
                onClick={
                  markAllNotificationsRead
                }
              >
                Read all
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="notificationEmpty">
              🔕 Abhi koi notification nahi.
            </p>
          ) : (
            notifications
              .slice(0, 20)
              .map((n) => (
                <div
                  className={
                    n.is_read
                      ? "notificationItem read"
                      : "notificationItem"
                  }
                  key={n.id}
                  onClick={() =>
                    markNotificationRead(n.id)
                  }
                >
                  <b>{n.title}</b>
                  <p>{n.message}</p>
                  <small>
                    {formatDate(n.created_at)}
                  </small>
                </div>
              ))
          )}
        </div>
      )}

      <main className="mainContent">
        {message && (
          <div className="messageBox">
            {message}
          </div>
        )}

        {tab === "home" && (
          <>
            <section className="hero">
              <span className="heroEmoji">
                😎
              </span>

              <h2>
                {isProvider
                  ? "Aaj kaun sa kaam pakadna hai?"
                  : "Jo chahiye, JUGAAD se milega"}
              </h2>

              <p>
                {isProvider
                  ? "Customer ka kaam dekho aur JUGAAD laga do."
                  : "Aapko kis cheez ki zarurat hai?"}
              </p>
            </section>

            {!isProvider && (
              <section className="requestBox">
                <textarea
                  value={need}
                  onChange={(e) =>
                    setNeed(e.target.value)
                  }
                  placeholder="Jaise: Ghar ka fan kharab hai, electrician chahiye..."
                  rows={4}
                />

                <div className="categoryRow">
                  {categories.map((c) => (
                    <button
                      key={c}
                      className={
                        category === c
                          ? "category active"
                          : "category"
                      }
                      onClick={() =>
                        setCategory(c)
                      }
                    >
                      {c}
                    </button>
                  ))}
                </div>

                <input
                  value={location}
                  onChange={(e) =>
                    setLocation(e.target.value)
                  }
                  placeholder="📍 Location — jaise Lucknow"
                />

                <button
                  className="primaryButton"
                  disabled={savingRequest}
                  onClick={createRequest}
                >
                  {savingRequest
                    ? "JUGAAD lag raha hai..."
                    : "JUGAAD Karo →"}
                </button>
              </section>
            )}

            {isProvider && (
              <section>
                <div className="sectionTitle">
                  <h2>🧰 Available Kaam</h2>
                  <button
                    onClick={loadRequests}
                  >
                    Refresh ↻
                  </button>
                </div>

                {providerRequests.length === 0 ? (
                  <div className="emptyCard">
                    😴 Abhi kaam nahi mila.
                    <br />
                    Thoda wait karo, JUGAAD dhoondh
                    raha hai.
                  </div>
                ) : (
                  <div className="requestGrid">
                    {providerRequests.map(
                      (request) => (
                        <div
                          className="requestCard"
                          key={request.id}
                        >
                          <div className="cardTop">
                            <span className="categoryTag">
                              {request.category ||
                                "General"}
                            </span>

                            <span className="statusPill">
                              {statusLabel(
                                request.status
                              )}
                            </span>
                          </div>

                          <h3>
                            {request.need}
                          </h3>

                          <p>
                            📍{" "}
                            {request.location ||
                              "Location not given"}
                          </p>

                          <small>
                            {formatDate(
                              request.created_at ||
                                request.create_at
                            )}
                          </small>

                          {request.status ===
                            STATUS.pending && (
                            <button
                              className="primaryButton"
                              onClick={() =>
                                acceptRequest(
                                  request.id
                                )
                              }
                            >
                              Kaam Lo 👍
                            </button>
                          )}

                          {request.provider_id ===
                            user.id &&
                            request.status ===
                              STATUS.accepted && (
                              <button
                                className="primaryButton"
                                onClick={() =>
                                  updateRequestStatus(
                                    request.id,
                                    STATUS.in_progress
                                  )
                                }
                              >
                                🚗 Main nikal raha hoon
                              </button>
                            )}

                          {request.provider_id ===
                            user.id &&
                            request.status ===
                              STATUS.in_progress && (
                              <button
                                className="primaryButton"
                                onClick={() =>
                                  updateRequestStatus(
                                    request.id,
                                    STATUS.completed
                                  )
                                }
                              >
                                ✅ Kaam Complete
                              </button>
                            )}
                        </div>
                      )
                    )}
                  </div>
                )}
              </section>
            )}

            <section>
              <div className="sectionTitle">
                <h2>
                  {isProvider
                    ? "Kaam categories"
                    : "Popular JUGAAD"}
                </h2>
              </div>

              <div className="serviceGrid">
                {services.map((service) => (
                  <div
                    className="serviceCard"
                    key={service}
                    onClick={() => {
                      if (!isProvider) {
                        setNeed(
                          `${service} chahiye`
                        );
                        setTab("home");
                      }
                    }}
                  >
                    <div className="serviceIcon">
                      {service ===
                      "Electrician"
                        ? "⚡"
                        : service ===
                          "Plumber"
                        ? "🔧"
                        : service ===
                          "Mobile Repair"
                        ? "📱"
                        : service ===
                          "AC/Cooler Repair"
                        ? "❄️"
                        : service ===
                          "Home Cleaning"
                        ? "🧹"
                        : "🚚"}
                    </div>

                    <b>{service}</b>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {tab === "requests" && (
          <section>
            <div className="sectionTitle">
              <div>
                <h2>📋 Meri Requests</h2>
                <p>
                  JUGAAD ka poora hisaab yahan.
                </p>
              </div>

              <button
                onClick={loadRequests}
              >
                Refresh ↻
              </button>
            </div>

            {customerRequests.length === 0 ? (
              <div className="emptyCard">
                📭 Abhi koi request nahi.
                <br />
                Chalo ek JUGAAD karte hain 😎
              </div>
            ) : (
              <div className="requestGrid">
                {customerRequests.map(
                  (request) => {
                    const requestMatches =
                      matches.filter(
                        (m) =>
                          m.request_id ===
                          request.id
                      );

                    return (
                      <div
                        className="requestCard"
                        key={request.id}
                      >
                        <div className="cardTop">
                          <span className="categoryTag">
                            {request.category ||
                              "General"}
                          </span>

                          <span className="statusPill">
                            {statusLabel(
                              request.status
                            )}
                          </span>
                        </div>

                        <h3>
                          {request.need}
                        </h3>

                        <p>
                          📍{" "}
                          {request.location ||
                            "Location not given"}
                        </p>

                        <small>
                          {formatDate(
                            request.created_at ||
                              request.create_at
                          )}
                        </small>

                        {requestMatches.length >
                          0 && (
                          <div className="matchBox">
                            <b>
                              🤝 Provider mil gaya!
                            </b>

                            {requestMatches.map(
                              (match) => (
                                <div
                                  key={match.id}
                                >
                                  <p>
                                    🧰 Provider:
                                    <br />
                                    <span className="mono">
                                      {match.provider_id ||
                                        match.worker_id ||
                                        "Assigned"}
                                    </span>
                                  </p>

                                  {match.quoted_amount !=
                                    null && (
                                    <p>
                                      💰 ₹
                                      {
                                        match.quoted_amount
                                      }
                                    </p>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        )}

                        {request.status ===
                          STATUS.accepted && (
                          <button
                            className="primaryButton"
                            onClick={() =>
                              updateRequestStatus(
                                request.id,
                                STATUS.in_progress
                              )
                            }
                          >
                            🚗 Provider aa raha hai
                          </button>
                        )}

                        {request.status ===
                          STATUS.in_progress && (
                          <button
                            className="primaryButton"
                            onClick={() =>
                              updateRequestStatus(
                                request.id,
                                STATUS.completed
                              )
                            }
                          >
                            ✅ Kaam ho gaya
                          </button>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </section>
        )}

        {tab === "profile" && (
          <section className="profilePage">
            <div className="profileHeader">
              <div className="bigAvatar">
                👤
              </div>

              <div>
                <h2>
                  {profile?.full_name ||
                    "JUGAAD User"}
                </h2>

                <span className="roleBadge">
                  {isProvider
                    ? "🧰 Provider"
                    : "🧑 Customer"}
                </span>
              </div>
            </div>

            <div className="profileForm">
              <label>Naam</label>
              <input
                value={profileName}
                onChange={(e) =>
                  setProfileName(e.target.value)
                }
                placeholder="Aapka naam"
              />

              <label>Phone</label>
              <input
                value={profilePhone}
                onChange={(e) =>
                  setProfilePhone(e.target.value)
                }
                placeholder="Phone number"
              />

              <label>Address</label>
              <textarea
                value={profileAddress}
                onChange={(e) =>
                  setProfileAddress(
                    e.target.value
                  )
                }
                placeholder="Preferred address"
              />

              <button
                className="primaryButton"
                disabled={savingProfile}
                onClick={saveProfile}
              >
                {savingProfile
                  ? "Saving..."
                  : "💾 Profile Save Karo"}
              </button>
            </div>

            <div className="roleSwitch">
              <h3>
                JUGAAD par kya karna hai?
              </h3>

              <button
                className={
                  !isProvider
                    ? "roleOption selected"
                    : "roleOption"
                }
                onClick={switchToCustomer}
              >
                🧑
                <div>
                  <b>Mujhe kaam chahiye</b>
                  <small>
                    Customer mode
                  </small>
                </div>
              </button>

              <button
                className={
                  isProvider
                    ? "roleOption selected"
                    : "roleOption"
                }
                onClick={switchToProvider}
              >
                🧰
                <div>
                  <b>Mujhe kaam karna hai</b>
                  <small>
                    Provider mode
                  </small>
                </div>
              </button>
            </div>

            <button
              className="logoutFull"
              onClick={logout}
            >
              🚪 Logout
            </button>
          </section>
        )}
      </main>

      <nav className="bottomNav">
        <button
          className={
            tab === "home" ? "navActive" : ""
          }
          onClick={() => setTab("home")}
        >
          <span>🏠</span>
          Home
        </button>

        <button
          className={
            tab === "requests"
              ? "navActive"
              : ""
          }
          onClick={() => setTab("requests")}
        >
          <span>📋</span>
          Requests
        </button>

        <button
          className={
            tab === "profile"
              ? "navActive"
              : ""
          }
          onClick={() => setTab("profile")}
        >
          <span>👤</span>
          Profile
        </button>
      </nav>
    </div>
  );
}
