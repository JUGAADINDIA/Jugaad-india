import { useEffect, useMemo, useRef, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";
import "./App.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

const CATEGORIES = [
  "Home",
  "Repair",
  "Delivery",
  "Personal",
  "Business",
  "Electrician",
  "Plumber",
  "Mobile Repair",
  "AC/Cooler Repair",
  "Home Cleaning",
  "Transport",
  "Tutor",
  "Other",
];

const STATUS = {
  pending: "pending",
  accepted: "accepted",
  in_progress: "in_progress",
  completed: "completed",
  cancelled: "cancelled",
};

function money(value: number | null | undefined) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return "—";
  }

  return `₹${Number(value).toLocaleString("en-IN")}`;
}

function timeText(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(value?: string | null) {
  return (value || "pending").replaceAll("_", " ");
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");

  const [tab, setTab] = useState<
    "home" | "explore" | "requests" | "profile"
  >("home");

  const [need, setNeed] = useState("");
  const [category, setCategory] = useState("Other");
  const [budget, setBudget] = useState("");
  const [location, setLocation] = useState("");
  const [inputType, setInputType] = useState<
    "text" | "voice" | "photo"
  >("text");

  const [requestBusy, setRequestBusy] = useState(false);

  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [providers, setProviders] = useState<Profile[]>([]);

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileLanguage, setProfileLanguage] = useState("Hindi");
  const [savingProfile, setSavingProfile] = useState(false);

  const [selectedRequest, setSelectedRequest] = useState<string | null>(
    null
  );

  const [ratingBusy, setRatingBusy] = useState(false);
  const [rating, setRating] = useState(5);

  const recognitionRef = useRef<any>(null);

  const role = String(profile?.role || "Customer").toLowerCase();

  const isProvider =
    role === "provider" ||
    role === "worker" ||
    role === "service_provider";

  const isAdmin =
    role === "admin" ||
    role === "super_admin";

  useEffect(() => {
    let mounted = true;

    async function start() {
      const { data } = await supabase.auth.getSession();

      if (!mounted) return;

      setUser(data.session?.user ?? null);

      if (data.session?.user) {
        await loadProfile(data.session.user.id);
      }

      setLoading(false);
    }

    start();

    const {
      data: listener,
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    loadRequests();
    loadProviders();
  }, [user, isProvider]);

  async function loadProfile(id: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("profile:", error.message);
      return;
    }

    if (data) {
      setProfile(data as Profile);
      setProfileName(data.full_name || "");
      setProfileAddress(data.preferred_address || "");
      setProfileLanguage(data.preferred_language || "Hindi");
      return;
    }

    const fallback = {
      id,
      full_name: "",
      role: "Customer",
      preferred_language: "Hindi",
      is_active: true,
    };

    const { data: created, error: createError } = await supabase
      .from("profiles")
      .upsert(fallback)
      .select("*")
      .single();

    if (createError) {
      console.error("profile create:", createError.message);
      return;
    }

    if (created) {
      setProfile(created as Profile);
    }
  }

  async function signInWithGoogle() {
    setAuthBusy(true);
    setAuthMessage("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setAuthMessage(error.message);
      setAuthBusy(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setTab("home");
    setRequests([]);
    setMatches([]);
  }

  async function loadRequests() {
    if (!user) return;

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
      console.error("requests:", error.message);
      return;
    }

    const sorted = ((data || []) as RequestRow[]).sort((a, b) => {
      const aTime = new Date(
        a.created_at || a.create_at || 0
      ).getTime();

      const bTime = new Date(
        b.created_at || b.create_at || 0
      ).getTime();

      return bTime - aTime;
    });

    setRequests(sorted);
  }

  async function loadProviders() {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("role", [
        "Provider",
        "provider",
        "Worker",
        "worker",
        "service_provider",
      ])
      .eq("is_active", true)
      .order("rating", { ascending: false })
      .limit(20);

    if (error) {
      console.error("providers:", error.message);
      return;
    }

    setProviders((data || []) as Profile[]);
  }

  async function createRequest() {
    if (!user) return;

    const cleanNeed = need.trim();

    if (!cleanNeed) {
      alert("Pehle batao kya chahiye 😄");
      return;
    }

    setRequestBusy(true);

    const payload = {
      user_id: user.id,
      need: cleanNeed,
      category,
      location:
        location.trim() ||
        profile?.preferred_address ||
        null,
      status: STATUS.pending,
    };

    const { error } = await supabase
      .from("requests")
      .insert(payload);

    if (error) {
      alert("Request save nahi hui: " + error.message);
      setRequestBusy(false);
      return;
    }

    setNeed("");
    setBudget("");
    setLocation("");
    setInputType("text");
    setTab("requests");

    await loadRequests();

    alert(
      "JUGAAD lag gaya! 🔧 Ab kaam dhoondhne nikal pade."
    );

    setRequestBusy(false);
  }

  async function acceptRequest(requestId: string) {
    if (!user) return;

    const amount = window.prompt(
      "Apna quote kitna rakhoge? ₹ (optional)"
    );

    const quote =
      amount?.trim() !== ""
        ? Number(amount)
        : null;

    if (
      quote !== null &&
      !Number.isFinite(quote)
    ) {
      alert("Quote amount sahi number mein daalo.");
      return;
    }

    const payload = {
      request_id: requestId,
      worker_id: user.id,
      provider_id: user.id,
      quoted_amount: quote,
      status: "accepted",
    };

    const { error } = await supabase
      .from("matches")
      .insert(payload);

    if (error) {
      alert(
        "Match create nahi hua: " +
          error.message
      );
      return;
    }

    const { error: updateError } =
      await supabase
        .from("requests")
        .update({
          status: STATUS.accepted,
          provider_id: user.id,
        })
        .eq("id", requestId);

    if (updateError) {
      alert(
        "Provider assign nahi hua: " +
          updateError.message
      );
      return;
    }

    await loadRequests();

    alert(
      "Kaam pakad liya! 😎 Customer ko bata diya gaya."
    );
  }

  async function loadMatches(requestId: string) {
    setSelectedRequest(requestId);

    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq("request_id", requestId);

    if (error) {
      console.error("matches:", error.message);
      return;
    }

    const sorted = ((data || []) as MatchRow[]).sort(
      (a, b) => {
        const aTime = new Date(
          a.created_at || 0
        ).getTime();

        const bTime = new Date(
          b.created_at || 0
        ).getTime();

        return bTime - aTime;
      }
    );

    setMatches(sorted);
  }

  async function updateRequestStatus(
    id: string,
    status: string
  ) {
    const { error } = await supabase
      .from("requests")
      .update({
        status,
      })
      .eq("id", id);

    if (error) {
      alert(
        "Status update nahi hua: " +
          error.message
      );
      return;
    }

    await loadRequests();

    if (status === STATUS.completed) {
      alert(
        "Kaam complete! 🎉 JUGAAD ne kaam kar diya."
      );
    }
  }

  async function saveProfile() {
    if (!user) return;

    setSavingProfile(true);

    const { data, error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        full_name:
          profileName.trim() || null,
        preferred_address:
          profileAddress.trim() || null,
        preferred_language:
          profileLanguage,
        is_active: true,
      })
      .select("*")
      .single();

    if (error) {
      alert(
        "Profile save error: " +
          error.message
      );
    } else {
      setProfile(data as Profile);
      setEditingProfile(false);

      alert(
        "Profile save ho gayi 😎"
      );
    }

    setSavingProfile(false);
  }

  function startVoice() {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Is browser mein voice input available nahi hai. Text se JUGAAD karo."
      );
      return;
    }

    recognitionRef.current?.stop();

    const recognition =
      new SpeechRecognition();

    recognition.lang =
      profileLanguage === "English"
        ? "en-IN"
        : "hi-IN";

    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => {
      setInputType("voice");
    };

    recognition.onresult = (
      event: any
    ) => {
      const text =
        event.results?.[0]?.[0]
          ?.transcript || "";

      setNeed(text);
      setInputType("voice");
    };

    recognition.onerror = (
      event: any
    ) => {
      console.error(
        "voice:",
        event?.error
      );

      alert(
        "Awaaz pakadne mein dikkat hui. Mic permission check karke dobara try karo."
      );
    };

    recognitionRef.current =
      recognition;

    recognition.start();
  }

  async function rateCompleted(
    requestId: string
  ) {
    if (!user) return;

    setRatingBusy(true);

    const { error } = await supabase
      .from("ratings")
      .insert({
        request_id: requestId,
        customer_id: user.id,
        rating,
      });

    if (error) {
      alert(
        "Rating abhi save nahi hui: " +
          error.message
      );
    } else {
      alert(
        "Rating mil gayi! ⭐"
      );
    }

    setRatingBusy(false);
  }

  const activeRequests = useMemo(
    () =>
      requests.filter(
        r =>
          ![
            STATUS.completed,
            STATUS.cancelled,
          ].includes(
            String(r.status)
          )
      ),
    [requests]
  );

  if (loading) {
    return (
      <div className="splash">
        <div className="logo-mark">
          💡
        </div>
        <h1>JUGAAD</h1>
        <p>
          Jugaad laga rahe hain...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="logo-mark">
            💡
          </div>

          <div className="brand">
            JUGAAD
          </div>

          <div className="tagline">
            Har zarurat ka jugaad 🇮🇳
          </div>

          <h1>
            Jo chahiye,
            <br />
            JUGAAD se milega.
          </h1>

          <p className="muted">
            Voice, photo ya text mein
            batao. Baaki jugaad hum
            dekh lenge 😎
          </p>

          <button
            className="google-btn big"
            disabled={authBusy}
            onClick={signInWithGoogle}
          >
            <span className="google-icon">
              G
            </span>

            {authBusy
              ? "Google khul raha hai..."
              : "Google se Login →"}
          </button>

          {authMessage && (
            <div className="message">
              {authMessage}
            </div>
          )}

          <div className="auth-note">
            Gmail/Google account se
            secure login.
          </div>
        </div>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="admin-gate">
        <div className="card">
          <div className="logo-mark">
            🛠️
          </div>

          <h1>Admin Account</h1>

          <p>
            Admin ke liye separate
            desktop dashboard rakha gaya
            hai.
          </p>

          <button
            className="primary"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-row">
          <div className="mini-logo">
            💡
          </div>

          <div>
            <div className="brand">
              JUGAAD
            </div>

            <div className="small-tag">
              Har zarurat ka jugaad 🇮🇳
            </div>
          </div>
        </div>

        <div className="top-user">
          <span>
            {profile?.full_name ||
              "JUGAAD User"}
          </span>

          <button
            className="icon-btn"
            onClick={logout}
          >
            ↪
          </button>
        </div>
      </header>

      <main className="main">
        {tab === "home" && (
          <section>
            <div className="hero">
              <span className="eyebrow">
                {isProvider
                  ? "JUGAAD PROVIDER 🧰"
                  : "JUGAAD READY 🚀"}
              </span>

              <h1>
                {isProvider ? (
                  <>
                    Kaam chahiye?
                    <br />
                    <b>JUGAAD pe milega.</b>
                  </>
                ) : (
                  <>
                    Jo chahiye,
                    <br />
                    <b>
                      JUGAAD se milega.
                    </b>
                  </>
                )}
              </h1>

              {!isProvider && (
                <>
                  <p>
                    Aapko kis cheez ki
                    zarurat hai?
                  </p>

                  <div className="need-box">
                    <textarea
                      value={need}
                      onChange={e => {
                        setNeed(
                          e.target.value
                        );
                        setInputType("text");
                      }}
                      placeholder="Jaise: Ghar ka fan kharab hai, electrician chahiye..."
                      rows={4}
                    />

                    <div className="input-actions">
                      <button
                        className={
                          inputType ===
                          "voice"
                            ? "tool active"
                            : "tool"
                        }
                        onClick={
                          startVoice
                        }
                      >
                        🎙️ Awaaz
                      </button>

                      <button
                        className={
                          inputType ===
                          "photo"
                            ? "tool active"
                            : "tool"
                        }
                        onClick={() =>
                          setInputType(
                            "photo"
                          )
                        }
                      >
                        📷 Photo
                      </button>

                      <button
                        className={
                          inputType ===
                          "text"
                            ? "tool active"
                            : "tool"
                        }
                        onClick={() =>
                          setInputType(
                            "text"
                          )
                        }
                      >
                        ⌨️ Text
                      </button>
                    </div>
                  </div>

                  <div className="grid-2">
                    <div>
                      <label>
                        Category
                      </label>

                      <select
                        value={category}
                        onChange={e =>
                          setCategory(
                            e.target.value
                          )
                        }
                      >
                        {CATEGORIES.map(
                          c => (
                            <option
                              key={c}
                            >
                              {c}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div>
                      <label>
                        Budget
                        (optional)
                      </label>

                      <input
                        inputMode="numeric"
                        value={budget}
                        onChange={e =>
                          setBudget(
                            e.target.value.replace(
                              /\D/g,
                              ""
                            )
                          )
                        }
                        placeholder="₹ Kitna socha hai?"
                      />
                    </div>
                  </div>

                  <label>
                    Location
                  </label>

                  <input
                    value={location}
                    onChange={e =>
                      setLocation(
                        e.target.value
                      )
                    }
                    placeholder={
                      profile?.preferred_address ||
                      "Area / City"
                    }
                  />

                  <button
                    className="primary big full"
                    disabled={requestBusy}
                    onClick={
                      createRequest
                    }
                  >
                    {requestBusy
                      ? "JUGAAD lag raha hai..."
                      : "JUGAAD Karo →"}
                  </button>
                </>
              )}

              {isProvider && (
                <div className="smile-card">
                  <span>😎</span>

                  <div>
                    <b>
                      Kaam ki talash mein
                      ho?
                    </b>

                    <p>
                      Neeche "Kaam" tab
                      kholo. Customer ki
                      requests wahi milengi.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {tab === "explore" && (
          <section>
            <SectionTitle
              title={
                isProvider
                  ? "Aas-paas ke Kaam"
                  : "JUGAAD Providers"
              }
              subtitle={
                isProvider
                  ? "Jo kaam aap kar sakte ho, uthao."
                  : "Service providers se connect hone ke options."
              }
            />

            {isProvider ? (
              <div className="stack">
                {requests.length === 0 && (
                  <Empty text="Abhi koi matching kaam nahi. Chai pi lo ☕" />
                )}

                {requests.map(
                  request => (
                    <RequestCard
                      key={request.id}
                      request={
                        request
                      }
                      provider
                      onAccept={() =>
                        acceptRequest(
                          request.id
                        )
                      }
                    />
                  )
                )}
              </div>
            ) : (
              <div className="provider-grid">
                {providers.length ===
                  0 && (
                  <Empty text="Providers abhi load nahi hue." />
                )}

                {providers.map(
                  p => (
                    <div
                      className="provider-card"
                      key={p.id}
                    >
                      <div className="avatar">
                        {(
                          p.full_name ||
                          "J"
                        )
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="provider-main">
                        <b>
                          {p.full_name ||
                            "JUGAAD Provider"}
                        </b>

                        <span>
                          {p.service_area ||
                            p.preferred_address ||
                            "Nearby"}
                        </span>

                        <span>
                          ⭐{" "}
                          {Number(
                            p.rating || 0
                          ).toFixed(
                            1
                          )}{" "}
                          ·{" "}
                          {p.completed_job ||
                            0}{" "}
                          jobs
                        </span>
                      </div>

                      {p.is_verified && (
                        <span className="verified">
                          ✓
                        </span>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        )}

        {tab === "requests" && (
          <section>
            <SectionTitle
              title={
                isProvider
                  ? "Mere Accepted Kaam"
                  : "Meri Requests"
              }
              subtitle={
                isProvider
                  ? "Kaam ka status yahin sambhalo."
                  : "Aapke saare JUGAAD ek jagah."
              }
            />

            <div className="stack">
              {activeRequests.length ===
                0 &&
                requests.length === 0 && (
                  <Empty text="Abhi koi request nahi. Ek JUGAAD laga do 😄" />
                )}

              {requests.map(
                request => (
                  <RequestCard
                    key={request.id}
                    request={
                      request
                    }
                    provider={
                      isProvider
                    }
                    onOpen={() =>
                      !isProvider &&
                      loadMatches(
                        request.id
                      )
                    }
                    selected={
                      selectedRequest ===
                      request.id
                    }
                    onStatus={status =>
                      updateRequestStatus(
                        request.id,
                        status
                      )
                    }
                  />
                )
              )}
            </div>

            {selectedRequest && (
              <div className="card matches-card">
                <div className="row-between">
                  <h3>
                    Matching
                    Providers
                  </h3>

                  <button
                    className="link-btn"
                    onClick={() =>
                      setSelectedRequest(
                        null
                      )
                    }
                  >
                    Close
                  </button>
                </div>

                {matches.length ===
                0 ? (
                  <Empty text="Abhi match nahi mila. Search chal raha hai 🔎" />
                ) : (
                  matches.map(
                    m => (
                      <div
                        className="match-row"
                        key={m.id}
                      >
                        <span>
                          Provider:{" "}
                          {m.provider_id ||
                            m.worker_id}
                        </span>

                        <span>
                          {money(
                            m.quoted_amount
                          )}{" "}
                          ·{" "}
                          {statusLabel(
                            m.status ||
                              m.matches_status
                          )}
                        </span>
                      </div>
                    )
                  )
                )}
              </div>
            )}
          </section>
        )}

        {tab === "profile" && (
          <section>
            <SectionTitle
              title="Mera Profile"
              subtitle="JUGAAD ko aapke baare mein thoda aur batao."
            />

            <div className="profile-card">
              <div className="profile-avatar">
                {(
                  profile?.full_name ||
                  "J"
                )
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <h2>
                {profile?.full_name ||
                  "Naam add karo"}
              </h2>

              <p>
                {profile?.phone ||
                  user.phone ||
                  ""}
              </p>

              <span className="role-pill">
                {profile?.role ||
                  "Customer"}
              </span>
            </div>

            {!editingProfile ? (
              <div className="card">
                <Info
                  label="Naam"
                  value={
                    profile?.full_name ||
                    "—"
                  }
                />

                <Info
                  label="Mobile"
                  value={
                    profile?.phone ||
                    user.phone ||
                    "—"
                  }
                />

                <Info
                  label="Language"
                  value={
                    profile?.preferred_language ||
                    "Hindi"
                  }
                />

                <Info
                  label="Address"
                  value={
                    profile?.preferred_address ||
                    "—"
                  }
                />

                <button
                  className="secondary full"
                  onClick={() =>
                    setEditingProfile(
                      true
                    )
                  }
                >
                  Profile Edit Karo
                </button>
              </div>
            ) : (
              <div className="card">
                <label>Naam</label>

                <input
                  value={profileName}
                  onChange={e =>
                    setProfileName(
                      e.target.value
                    )
                  }
                />

                <label>
                  Preferred Language
                </label>

                <select
                  value={
                    profileLanguage
                  }
                  onChange={e =>
                    setProfileLanguage(
                      e.target.value
                    )
                  }
                >
                  <option>
                    Hindi
                  </option>
                  <option>
                    Hinglish
                  </option>
                  <option>
                    English
                  </option>
                </select>

                <label>
                  Preferred Address
                </label>

                <textarea
                  value={
                    profileAddress
                  }
                  onChange={e =>
                    setProfileAddress(
                      e.target.value
                    )
                  }
                  rows={3}
                />

                <div className="grid-2">
                  <button
                    className="secondary"
                    onClick={() =>
                      setEditingProfile(
                        false
                      )
                    }
                  >
                    Cancel
                  </button>

                  <button
                    className="primary"
                    disabled={
                      savingProfile
                    }
                    onClick={
                      saveProfile
                    }
                  >
                    {savingProfile
                      ? "Saving..."
                      : "Save"}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <nav className="bottom-nav">
        <NavButton
          active={tab === "home"}
          icon="🏠"
          text="Home"
          onClick={() =>
            setTab("home")
          }
        />

        <NavButton
          active={
            tab === "explore"
          }
          icon={
            isProvider
              ? "🧰"
              : "🔎"
          }
          text={
            isProvider
              ? "Kaam"
              : "Explore"
          }
          onClick={() =>
            setTab("explore")
          }
        />

        <NavButton
          active={
            tab === "requests"
          }
          icon="📋"
          text="Requests"
          onClick={() =>
            setTab("requests")
          }
        />

        <NavButton
          active={
            tab === "profile"
          }
          icon="👤"
          text="Profile"
          onClick={() =>
            setTab("profile")
          }
        />
      </nav>
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="section-title">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function Empty({
  text,
}: {
  text: string;
}) {
  return (
    <div className="empty">
      <div>🛠️</div>
      <p>{text}</p>
    </div>
  );
}

function NavButton({
  active,
  icon,
  text,
  onClick,
}: {
  active: boolean;
  icon: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      className={
        active
          ? "nav-btn active"
          : "nav-btn"
      }
      onClick={onClick}
    >
      <span>{icon}</span>
      <small>{text}</small>
    </button>
  );
}

function RequestCard({
  request,
  provider,
  selected,
  onAccept,
  onOpen,
  onStatus,
}: {
  request: RequestRow;
  provider?: boolean;
  selected?: boolean;
  onAccept?: () => void;
  onOpen?: () => void;
  onStatus?: (
    status: string
  ) => void;
}) {
  const title =
    request.need ||
    "JUGAAD Request";

  const description =
    request.need || "";

  const status = String(
    request.status ||
      "pending"
  );

  return (
    <div
      className={
        selected
          ? "request-card selected"
          : "request-card"
      }
    >
      <div className="row-between">
        <span className="category-pill">
          {request.category ||
            "Other"}
        </span>

        <span
          className={`status status-${status}`}
        >
          {statusLabel(status)}
        </span>
      </div>

      <h3>{title}</h3>

      {description && (
        <p>{description}</p>
      )}

      <div className="request-meta">
        <span>
          📍{" "}
          {request.location ||
            "Location pending"}
        </span>
      </div>

      <div className="request-footer">
        <small>
          {timeText(
            request.created_at ||
              request.create_at
          )}
        </small>

        <div className="actions">
          {provider &&
            status ===
              STATUS.pending && (
              <button
                className="primary small"
                onClick={
                  onAccept
                }
              >
                Kaam Lo 👍
              </button>
            )}

          {!provider && (
            <button
              className="secondary small"
              onClick={onOpen}
            >
              Matches
            </button>
          )}

          {!provider &&
            status ===
              STATUS.accepted && (
              <button
                className="primary small"
                onClick={() =>
                  onStatus?.(
                    STATUS.in_progress
                  )
                }
              >
                Kaam Start
              </button>
            )}

          {!provider &&
            status ===
              STATUS.in_progress && (
              <button
                className="primary small"
                onClick={() =>
                  onStatus?.(
                    STATUS.completed
                  )
                }
              >
                Complete ✓
              </button>
            )}

          {!provider &&
            ![
              STATUS.completed,
              STATUS.cancelled,
            ].includes(status) && (
              <button
                className="danger small"
                onClick={() =>
                  onStatus?.(
                    STATUS.cancelled
                  )
                }
              >
                Cancel
              </button>
            )}
        </div>
      </div>
    </div>
  );
}

export default App;
