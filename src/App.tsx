import { useEffect, useMemo, useState } from "react";
import {
  createClient,
  User,
} from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

type RequestItem = {
  id: string;
  customer_id: string;
  title: string;
  description: string | null;
  input_type: string | null;
  category: string | null;
  budget: number | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  required_at: string | null;
  target_at: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
};

type MatchItem = {
  id: string;
  request_id: string;
  worker_id: string | null;
  provider_id: string | null;
  quoted_amount: number | null;
  distance_km: number | null;
  matches_status: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string | null;
  preferred_language: string | null;
};

const services = [
  ["🔌", "Electrician"],
  ["🔧", "Plumber"],
  ["📱", "Mobile Repair"],
  ["❄️", "AC / Cooler"],
  ["🧹", "Home Cleaning"],
  ["🚚", "Delivery"],
  ["💻", "Online / Digital"],
  ["📚", "Education"],
  ["🚕", "Travel"],
  ["🙋", "Personal"],
  ["🏢", "Business"],
  ["🛠️", "Other"],
];

const categories = [
  "Sab",
  "Repair",
  "Delivery",
  "Personal",
  "Business",
  "Education",
  "Travel",
  "Digital",
  "Other",
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const [tab, setTab] = useState<
    "home" | "explore" | "requests" | "profile" | "provider"
  >("home");

  const [mode, setMode] = useState<
    "customer" | "provider"
  >("customer");

  const [requestTitle, setRequestTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("Sab");

  const [requests, setRequests] = useState<RequestItem[]>(
    []
  );

  const [providerRequests, setProviderRequests] =
    useState<RequestItem[]>([]);

  const [matches, setMatches] = useState<MatchItem[]>([]);

  const [quoteValues, setQuoteValues] = useState<
    Record<string, string>
  >({});

  const [selectedService, setSelectedService] =
    useState("");

  const isProvider =
    profile?.role === "provider" ||
    profile?.role === "worker" ||
    profile?.role === "service_provider";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setRequests([]);
      setMatches([]);
      setProviderRequests([]);
      return;
    }

    loadProfile();
    loadRequests();
    loadMatches();
  }, [user]);

  useEffect(() => {
    if (user && isProvider) {
      loadProviderRequests();
    }
  }, [user, isProvider]);

  async function loadProfile() {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, full_name, phone, avatar_url, role, preferred_language"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (!error && data) {
      setProfile(data);

      if (
        data.role === "provider" ||
        data.role === "worker" ||
        data.role === "service_provider"
      ) {
        setMode("provider");
      } else {
        setMode("customer");
      }
    }
  }

  async function loadRequests() {
    if (!user) return;

    const { data, error } = await supabase
      .from("requests")
      .select(
        "id, customer_id, title, description, input_type, category, budget, location, latitude, longitude, required_at, target_at, status, created_at, updated_at"
      )
      .eq("customer_id", user.id)
      .order("created_at", {
        ascending: false,
      });

    if (!error) {
      setRequests(data ?? []);
    }
  }

  async function loadProviderRequests() {
    if (!user) return;

    const { data, error } = await supabase
      .from("requests")
      .select(
        "id, customer_id, title, description, input_type, category, budget, location, latitude, longitude, required_at, target_at, status, created_at, updated_at"
      )
      .eq("status", "pending")
      .order("created_at", {
        ascending: false,
      });

    if (!error) {
      setProviderRequests(data ?? []);
    }
  }

  async function loadMatches() {
    if (!user) return;

    const { data, error } = await supabase
      .from("matches")
      .select(
        "id, request_id, worker_id, provider_id, quoted_amount, distance_km, matches_status, created_at"
      )
      .or(
        `worker_id.eq.${user.id},provider_id.eq.${user.id}`
      )
      .order("created_at", {
        ascending: false,
      });

    if (!error) {
      setMatches(data ?? []);
    }
  }

  async function sendOtp() {
    if (!phone.trim()) {
      alert("Phone number डालो");
      return;
    }

    setLoading(true);

    const cleanPhone = phone.startsWith("+")
      ? phone
      : `+91${phone.replace(/\D/g, "")}`;

    const { error } =
      await supabase.auth.signInWithOtp({
        phone: cleanPhone,
      });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setOtpSent(true);
    alert("OTP भेज दिया गया है");
  }

  async function verifyOtp() {
    if (!otp.trim()) {
      alert("OTP डालो");
      return;
    }

    setLoading(true);

    const cleanPhone = phone.startsWith("+")
      ? phone
      : `+91${phone.replace(/\D/g, "")}`;

    const { data, error } =
      await supabase.auth.verifyOtp({
        phone: cleanPhone,
        token: otp.trim(),
        type: "sms",
      });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setUser(data.user);
  }

  async function logout() {
    await supabase.auth.signOut();

    setUser(null);
    setProfile(null);
    setRequests([]);
    setMatches([]);
    setProviderRequests([]);
    setTab("home");
    setMode("customer");
  }

  async function askJugaad() {
    if (!user) {
      alert("पहले login करो");
      setTab("profile");
      return;
    }

    if (!message.trim()) {
      alert("अपनी जरूरत लिखो");
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from("requests")
      .insert({
        customer_id: user.id,
        title:
          requestTitle.trim() ||
          message.trim().slice(0, 60),
        description: message.trim(),
        input_type: "text",
        category:
          category === "Sab" ? null : category,
        budget: null,
        location: "Lucknow",
        latitude: null,
        longitude: null,
        required_at: null,
        target_at: null,
        status: "pending",
      });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setRequestTitle("");
    setMessage("");
    setCategory("Sab");

    await loadRequests();

    alert(
      "आपकी request JUGAAD पर भेज दी गई है"
    );

    setTab("requests");
  }

  async function becomeProvider() {
    if (!user) {
      setTab("profile");
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        role: "provider",
      })
      .eq("id", user.id);

    setLoading(false);

    if (error) {
      alert(
        "Provider mode activate नहीं हुआ: " +
          error.message
      );
      return;
    }

    await loadProfile();
    await loadProviderRequests();

    setMode("provider");
    setTab("provider");

    alert("अब आपका Provider mode चालू है");
  }

  async function sendQuote(
    request: RequestItem
  ) {
    if (!user) return;

    const rawQuote =
      quoteValues[request.id];

    if (
      !rawQuote ||
      Number(rawQuote) <= 0
    ) {
      alert("पहले अपना quote amount डालो");
      return;
    }

    const amount = Number(rawQuote);

    setLoading(true);

    const { data: existing } =
      await supabase
        .from("matches")
        .select("id")
        .eq("request_id", request.id)
        .or(
          `worker_id.eq.${user.id},provider_id.eq.${user.id}`
        )
        .maybeSingle();

    let error = null;

    if (existing?.id) {
      const result = await supabase
        .from("matches")
        .update({
          quoted_amount: amount,
          matches_status: "quoted",
        })
        .eq("id", existing.id);

      error = result.error;
    } else {
      const result = await supabase
        .from("matches")
        .insert({
          request_id: request.id,
          worker_id: user.id,
          provider_id: user.id,
          quoted_amount: amount,
          distance_km: null,
          matches_status: "quoted",
        });

      error = result.error;
    }

    setLoading(false);

    if (error) {
      alert(
        "Quote भेजने में error: " +
          error.message
      );
      return;
    }

    setQuoteValues((prev) => ({
      ...prev,
      [request.id]: "",
    }));

    await loadMatches();

    alert(
      "आपका quote customer को भेज दिया गया है"
    );
  }

  async function acceptQuote(
    match: MatchItem
  ) {
    if (!user) return;

    setLoading(true);

    const { error: matchError } =
      await supabase
        .from("matches")
        .update({
          matches_status: "accepted",
        })
        .eq("id", match.id);

    if (matchError) {
      setLoading(false);
      alert(matchError.message);
      return;
    }

    const { error: requestError } =
      await supabase
        .from("requests")
        .update({
          status: "matched",
        })
        .eq("id", match.request_id)
        .eq("customer_id", user.id);

    setLoading(false);

    if (requestError) {
      alert(requestError.message);
      return;
    }

    await loadRequests();
    await loadMatches();

    alert("Provider accept हो गया");
  }

  const serviceList = useMemo(() => {
    return services.filter((item) => {
      if (!selectedService) return true;

      return item[1] === selectedService;
    });
  }, [selectedService]);

  if (!user) {
    return (
      <div style={styles.authPage}>
        <div style={styles.authPattern} />

        <div style={styles.authCard}>
          <div style={styles.bulb}>
            💡
          </div>

          <div style={styles.logo}>
            JUGAAD
          </div>

          <div style={styles.logoSub}>
            INDIA
          </div>

          <div style={styles.yellowLine} />

          <h1 style={styles.authTitle}>
            हर काम का
            <br />
            <span>JUGAAD</span>
          </h1>

          <p style={styles.authText}>
            Problem कोई भी हो.
            <br />
            JUGAAD ready है!
          </p>

          {!otpSent ? (
            <>
              <input
                style={styles.input}
                value={phone}
                onChange={(e) =>
                  setPhone(e.target.value)
                }
                placeholder="Mobile number"
                inputMode="tel"
              />

              <button
                style={styles.primaryButton}
                onClick={sendOtp}
                disabled={loading}
              >
                {loading
                  ? "भेज रहे हैं..."
                  : "OTP भेजें"}
              </button>
            </>
          ) : (
            <>
              <input
                style={styles.input}
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value)
                }
                placeholder="OTP"
                inputMode="numeric"
              />

              <button
                style={styles.primaryButton}
                onClick={verifyOtp}
                disabled={loading}
              >
                {loading
                  ? "Verify..."
                  : "OTP Verify करें"}
              </button>

              <button
                style={styles.textButton}
                onClick={() =>
                  setOtpSent(false)
                }
              >
                नंबर बदलें
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.headerBrand}>
          <div style={styles.headerBulb}>
            💡
          </div>

          <div>
            <div style={styles.brand}>
              JUGAAD
            </div>

            <div style={styles.brandSub}>
              INDIA
            </div>
          </div>
        </div>

        <button
          style={styles.locationButton}
          onClick={() =>
            alert(
              "Live GPS अगले development step में connect होगा"
            )
          }
        >
          📍 Lucknow
        </button>
      </header>

      <main style={styles.content}>
        {tab === "home" && (
          <>
            <div style={styles.hero}>
              <div style={styles.heroBadge}>
                DESI APP • DESI LOG
              </div>

              <div style={styles.heroTitle}>
                आपको क्या चाहिए?
              </div>

              <div style={styles.heroText}>
                काम छोटा हो या बड़ा,
                <br />
                <strong>
                  JUGAAD ढूंढ देगा।
                </strong>
              </div>

              <textarea
                style={styles.bigInput}
                value={message}
                onChange={(e) =>
                  setMessage(e.target.value)
                }
                placeholder="जैसे: घर में पंखा खराब है, electrician चाहिए..."
              />

              <input
                style={styles.input}
                value={requestTitle}
                onChange={(e) =>
                  setRequestTitle(
                    e.target.value
                  )
                }
                placeholder="काम का छोटा नाम (optional)"
              />

              <div style={styles.categoryRow}>
                {categories.map((item) => (
                  <button
                    key={item}
                    style={{
                      ...styles.categoryButton,
                      ...(category === item
                        ? styles.categoryActive
                        : {}),
                    }}
                    onClick={() =>
                      setCategory(item)
                    }
                  >
                    {item}
                  </button>
                ))}
              </div>

              <button
                style={styles.primaryButton}
                onClick={askJugaad}
                disabled={loading}
              >
                {loading
                  ? "ढूंढ रहे हैं..."
                  : "JUGAAD ढूंढो →"}
              </button>

              <div style={styles.quickRow}>
                <button
                  style={styles.quickButton}
                  onClick={() =>
                    alert(
                      "Voice input अगले development step में connect होगा"
                    )
                  }
                >
                  🎤 Voice
                </button>

                <button
                  style={styles.quickButton}
                  onClick={() =>
                    alert(
                     
