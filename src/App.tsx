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
  created_at?: string | null;
  updated_at?: string | null;
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

type PaymentRow = {
  id: string;
  request_id?: string | null;
  match_id?: string | null;
  customer_id?: string | null;
  provider_id?: string | null;
  amount: number;
  platform_fee?: number | null;
  provider_amount?: number | null;
  payment_method?: string | null;
  transaction_id?: string | null;
  payment_status?: string | null;
  payment_proof_url?: string | null;
  notes?: string | null;
  created_at?: string | null;
  paid_at?: string | null;
  updated_at?: string | null;
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
  { name: "Electrician", icon: "⚡", category: "Repair" },
  { name: "Plumber", icon: "🔧", category: "Home" },
  { name: "Mobile Repair", icon: "📱", category: "Repair" },
  { name: "AC/Cooler Repair", icon: "❄️", category: "Repair" },
  { name: "Home Cleaning", icon: "🧹", category: "Home" },
  { name: "Delivery Help", icon: "🛵", category: "Delivery" },
];

const formatDate = (value?: string | null) => {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

const statusLabel = (status?: string | null) => {
  switch (status) {
    case "pending":
      return "⏳ Pending";
    case "accepted":
      return "🤝 Accepted";
    case "in_progress":
      return "🛠️ In Progress";
    case "completed":
      return "✅ Completed";
    case "cancelled":
      return "❌ Cancelled";
    default:
      return status || "Unknown";
  }
};

const paymentLabel = (status?: string | null) => {
  switch (status) {
    case "pending":
      return "⏳ Pending";
    case "paid":
      return "✅ Paid";
    case "failed":
      return "❌ Failed";
    case "refunded":
      return "↩️ Refunded";
    case "cancelled":
      return "🚫 Cancelled";
    default:
      return status || "Pending";
  }
};

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
  const [users, setUsers] = useState<Profile[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const [showNotifications, setShowNotifications] = useState(false);
  const [message, setMessage] = useState("");

  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [adminSection, setAdminSection] = useState("dashboard");
  const [adminSearch, setAdminSearch] = useState("");
  const [requestFilter, setRequestFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [paymentRequestId, setPaymentRequestId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [paymentTransactionId, setPaymentTransactionId] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const role = String(profile?.role || "customer").toLowerCase();

  const isAdmin =
    role === "admin" ||
    role === "super_admin";

  const isProvider =
    role === "provider" ||
    role === "worker" ||
    role === "service_provider";

  const unreadCount = notifications.filter(
    (n) => !n.is_read
  ).length;

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (mounted) {
        setUser(session?.user || null);
      }

      setLoading(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

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
  }, [user, profile, isAdmin]);

  useEffect(() => {
    if (!user) return;

    const timer = window.setInterval(() => {
      loadNotifications(user.id);

      if (profile) {
        if (isAdmin) {
          loadAdminData();
        } else {
          loadRequests();
          loadMatches();
        }
      }
    }, 15000);

    return () => window.clearInterval(timer);
  }, [user, profile, isAdmin]);

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error(error);
      return;
    }

    if (data) {
      setProfile(data as Profile);
      setProfileName(data.full_name || "");
      setProfilePhone(data.phone || "");
      setProfileAddress(data.preferred_address || "");
    }
  };

  const loadRequests = async () => {
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
      console.error("requests:", error);
      return;
    }

    const sorted = ((data || []) as RequestRow[]).sort(
      (a, b) =>
        new Date(
          b.created_at || b.create_at || 0
        ).getTime() -
        new Date(
          a.created_at || a.create_at || 0
        ).getTime()
    );

    setRequests(sorted);
  };

  const loadMatches = async () => {
    if (!user) return;

    let query = supabase
      .from("matches")
      .select("*");

    if (!isAdmin) {
      if (isProvider) {
        query = query.or(
          `provider_id.eq.${user.id},worker_id.eq.${user.id}`
        );
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error("matches:", error);
      return;
    }

    setMatches((data || []) as MatchRow[]);
  };

  const loadNotifications = async (userId: string) => {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("notifications:", error);
      return;
    }

    setNotifications((data || []) as NotificationRow[]);
  };

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("users:", error);
      return;
    }

    setUsers((data || []) as Profile[]);
  };

  const loadPayments = async () => {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("payments:", error);
      setPayments([]);
      return;
    }

    setPayments((data || []) as PaymentRow[]);
  };

  const loadAdminData = async () => {
    await Promise.all([
      loadRequests(),
      loadMatches(),
      loadUsers(),
      loadPayments(),
    ]);
  };

  const createRequest = async () => {
    if (!user) {
      setMessage("🔐 Pehle login karo.");
      return;
    }

    const cleanNeed = need.trim();

    if (!cleanNeed) {
      setMessage("😎 Bhai, kaam to batao!");
      return;
    }

    setSavingRequest(true);

    const { error } = await supabase
      .from("requests")
      .insert({
        user_id: user.id,
        need: cleanNeed,
        category:
          category === "Sab"
            ? null
            : category,
        location:
          location.trim() ||
          profile?.preferred_address ||
          null,
        status: STATUS.pending,
      });

    setSavingRequest(false);

    if (error) {
      console.error(error);
      setMessage(
        `❌ Request save nahi hui: ${error.message}`
      );
      return;
    }

    setNeed("");
    setLocation("");
    setMessage(
      "🎉 JUGAAD lag gaya! Kaam dhoondh rahe hain."
    );

    await loadRequests();
    setTab("requests");
  };

  const useService = (serviceName: string) => {
    setNeed(
      `Mujhe ${serviceName.toLowerCase()} chahiye`
    );
    setCategory(
      services.find(
        (s) => s.name === serviceName
      )?.category || "Sab"
    );
    setTab("home");
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const acceptRequest = async (
    requestId: string
  ) => {
    if (!user || !isProvider) return;

    const { data: existing } = await supabase
      .from("matches")
      .select("id")
      .eq("request_id", requestId)
      .eq("provider_id", user.id)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase
        .from("matches")
        .insert({
          request_id: requestId,
          provider_id: user.id,
          worker_id: user.id,
          status: "accepted",
          matches_status: "accepted",
        });

      if (error) {
        console.error(error);
        setMessage(
          `❌ Match create nahi hua: ${error.message}`
        );
        return;
      }
    }

    const { error } = await supabase
      .from("requests")
      .update({
        status: STATUS.accepted,
        provider_id: user.id,
      })
      .eq("id", requestId);

    if (error) {
      setMessage(
        `❌ Request update nahi hui: ${error.message}`
      );
      return;
    }

    setMessage(
      "🔥 Kaam pakad liya! Customer ko bata diya."
    );

    await loadRequests();
    await loadMatches();
    await loadNotifications(user.id);
  };

  const updateRequestStatus = async (
    requestId: string,
    status: string
  ) => {
    const { error } = await supabase
      .from("requests")
      .update({ status })
      .eq("id", requestId);

    if (error) {
      setMessage(
        `❌ Status update nahi hua: ${error.message}`
      );
      return;
    }

    setMessage(
      status === STATUS.completed
        ? "🎉 Kaam complete mark ho gaya!"
        : `✅ Status: ${statusLabel(status)}`
    );

    await loadRequests();

    if (isAdmin) {
      await loadAdminData();
    }
  };

  const saveProfile = async () => {
    if (!user) return;

    setSavingProfile(true);

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
      setMessage(
        `❌ Profile save nahi hua: ${error.message}`
      );
      return;
    }

    await loadProfile(user.id);

    setMessage(
      "💾 Profile save ho gaya!"
    );
  };

  const switchToProvider = async () => {
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        role: "provider",
        is_active: true,
      });

    if (error) {
      setMessage(
        `❌ Provider mode nahi laga: ${error.message}`
      );
      return;
    }

    await loadProfile(user.id);

    setMessage(
      "🧰 Provider mode ON! Ab kaam pakdo."
    );
  };

  const switchToCustomer = async () => {
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        role: "customer",
      });

    if (error) {
      setMessage(
        `❌ Customer mode nahi laga: ${error.message}`
      );
      return;
    }

    await loadProfile(user.id);

    setMessage(
      "🙋 Customer mode ON!"
    );
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const markNotificationRead = async (
    notificationId: string
  ) => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("user_id", user?.id);

    if (!error && user) {
      await loadNotifications(user.id);
    }
  };

  const markAllNotificationsRead = async () => {
    if (!user) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (!error) {
      await loadNotifications(user.id);
    }
  };

  const updateUserActive = async (
    userId: string,
    active: boolean
  ) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: active })
      .eq("id", userId);

    if (error) {
      setMessage(
        `❌ User update nahi hua: ${error.message}`
      );
      return;
    }

    setMessage(
      active
        ? "🟢 User active kar diya."
        : "🔴 User deactivate kar diya."
    );

    await loadUsers();
  };

  const updateUserVerified = async (
    userId: string,
    verified: boolean
  ) => {
    const { error } = await supabase
      .from("profiles")
      .update({
        is_verified: verified,
      })
      .eq("id", userId);

    if (error) {
      setMessage(
        `❌ Verification update nahi hua: ${error.message}`
      );
      return;
    }

    setMessage(
      verified
        ? "✅ User verified."
        : "⚠️ Verification hata di."
    );

    await loadUsers();
  };

  const updateUserRole = async (
    userId: string,
    newRole: string
  ) => {
    if (newRole === "admin") {
      setMessage(
        "🔐 Admin role yahan se change nahi kiya ja sakta."
      );
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (error) {
      setMessage(
        `❌ Role update nahi hua: ${error.message}`
      );
      return;
    }

    setMessage("👤 User role update ho gaya.");
    await loadUsers();
  };

  const updatePaymentStatus = async (
    paymentId: string,
    status: string
  ) => {
    const values: Record<string, unknown> = {
      payment_status: status,
      updated_at: new Date().toISOString(),
    };

    if (status === "paid") {
      values.paid_at =
        new Date().toISOString();
    }

    const { error } = await supabase
      .from("payments")
      .update(values)
      .eq("id", paymentId);

    if (error) {
      setMessage(
        `❌ Payment update nahi hua: ${error.message}`
      );
      return;
    }

    setMessage(
      `💳 Payment ${paymentLabel(status)}`
    );

    await loadPayments();
  };

  const createPayment = async () => {
    if (!user || !paymentAmount.trim()) {
      setMessage("💰 Amount bharna zaroori hai.");
      return;
    }

    const amount = Number(
      paymentAmount
    );

    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("💰 Valid amount daalo.");
      return;
    }

    setSavingPayment(true);

    const selectedRequest =
      requests.find(
        (r) => r.id === paymentRequestId
      );

    let customerId =
      selectedRequest?.user_id || null;

    let providerId =
      selectedRequest?.provider_id || null;

    if (paymentRequestId) {
      const { data: match } =
        await supabase
          .from("matches")
          .select("*")
          .eq(
            "request_id",
            paymentRequestId
          )
          .order("created_at", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

      if (match) {
        providerId =
          match.provider_id ||
          match.worker_id ||
          providerId;
      }
    }

    const platformFee = 0;
    const providerAmount =
      amount - platformFee;

    const { error } = await supabase
      .from("payments")
      .insert({
        request_id:
          paymentRequestId || null,
        customer_id: customerId,
        provider_id: providerId,
        amount,
        platform_fee: platformFee,
        provider_amount: providerAmount,
        payment_method: paymentMethod,
        transaction_id:
          paymentTransactionId.trim() ||
          null,
        payment_status: "pending",
        notes:
          paymentNotes.trim() || null,
      });

    setSavingPayment(false);

    if (error) {
      setMessage(
        `❌ Payment create nahi hua: ${error.message}`
      );
      return;
    }

    setPaymentFormOpen(false);
    setPaymentRequestId("");
    setPaymentAmount("");
    setPaymentTransactionId("");
    setPaymentNotes("");

    setMessage(
      "💳 Payment query create ho gayi."
    );

    await loadPayments();
  };

  const customerRequests = useMemo(() => {
    if (!user) return [];

    return requests.filter(
      (r) => r.user_id === user.id
    );
  }, [requests, user]);

  const providerRequests = useMemo(
    () => requests,
    [requests]
  );

  const requestMap = useMemo(() => {
    const map: Record<
      string,
      RequestRow
    > = {};

    requests.forEach((r) => {
      map[r.id] = r;
    });

    return map;
  }, [requests]);

  const userMap = useMemo(() => {
    const map: Record<
      string,
      Profile
    > = {};

    users.forEach((u) => {
      map[u.id] = u;
    });

    return map;
  }, [users]);

  const adminStats = useMemo(() => {
    const totalUsers = users.length;

    const customers = users.filter(
      (u) =>
        String(u.role).toLowerCase() ===
        "customer"
    ).length;

    const providers = users.filter(
      (u) =>
        ["provider", "worker"].includes(
          String(u.role).toLowerCase()
        )
    ).length;

    const pendingRequests =
      requests.filter(
        (r) =>
          r.status === STATUS.pending
      ).length;

    const activeJobs =
      requests.filter(
        (r) =>
          r.status === STATUS.accepted ||
          r.status === STATUS.in_progress
      ).length;

    const completed =
      requests.filter(
        (r) =>
          r.status === STATUS.completed
      ).length;

    const pendingPayments =
      payments.filter(
        (p) =>
          p.payment_status === "pending"
      ).length;

    const paidAmount = payments
      .filter(
        (p) =>
          p.payment_status === "paid"
      )
      .reduce(
        (sum, p) =>
          sum + Number(p.amount || 0),
        0
      );

    return {
      totalUsers,
      customers,
      providers,
      requests: requests.length,
      pendingRequests,
      activeJobs,
      completed,
      matches: matches.length,
      pendingPayments,
      paidAmount,
    };
  }, [
    users,
    requests,
    matches,
    payments,
  ]);

  const filteredAdminRequests =
    useMemo(() => {
      const search =
        adminSearch.trim().toLowerCase();

      return requests.filter((r) => {
        const matchesStatus =
          requestFilter === "all" ||
          r.status === requestFilter;

        const matchesSearch =
          !search ||
          String(r.need || "")
            .toLowerCase()
            .includes(search) ||
          String(r.location || "")
            .toLowerCase()
            .includes(search) ||
          String(r.category || "")
            .toLowerCase()
            .includes(search) ||
          String(r.id || "")
            .toLowerCase()
            .includes(search);

        return (
          matchesStatus &&
          matchesSearch
        );
      });
    }, [
      requests,
      requestFilter,
      adminSearch,
    ]);

  const filteredUsers = useMemo(() => {
    const search =
      adminSearch.trim().toLowerCase();

    if (!search) return users;

    return users.filter((u) =>
      [
        u.full_name,
        u.phone,
        u.role,
        u.preferred_address,
        u.service_area,
        u.id,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(search)
        )
    );
  }, [users, adminSearch]);

  const filteredPayments =
    useMemo(() => {
      const search =
        adminSearch.trim().toLowerCase();

      return payments.filter((p) => {
        const matchesStatus =
          paymentFilter === "all" ||
          p.payment_status ===
            paymentFilter;

        const customer =
          p.customer_id
            ? userMap[p.customer_id]
            : null;

        const provider =
          p.provider_id
            ? userMap[p.provider_id]
            : null;

        const matchesSearch =
          !search ||
          String(p.id || "")
            .toLowerCase()
            .includes(search) ||
          String(
            p.transaction_id || ""
          )
            .toLowerCase()
            .includes(search) ||
          String(
            customer?.full_name || ""
          )
            .toLowerCase()
            .includes(search) ||
          String(
            provider?.full_name || ""
          )
            .toLowerCase()
            .includes(search);

        return (
          matchesStatus &&
          matchesSearch
        );
      });
    }, [
      payments,
      paymentFilter,
      adminSearch,
      userMap,
    ]);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-logo">
          💡😎
        </div>
        <h2>JUGAAD</h2>
        <p>
          Jugaad machine garam ho rahi hai...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="brand-big">
            💡😎
          </div>

          <h1>JUGAAD</h1>

          <p>
            Har zarurat ka jugaad 🇮🇳
          </p>

          <button
            className="primary-btn"
            onClick={async () => {
              setMessage(
                "🔐 Login flow app ke existing Auth screen se chalega."
              );
            }}
          >
            JUGAAD Karo →
          </button>

          <p className="small-note">
            Login ke baad JUGAAD khud samajh
            jayega ki Customer, Provider ya
            Admin kaun hai.
          </p>

          {message && (
            <div className="toast">
              {message}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="admin-app">
        <aside className="admin-sidebar">
          <div className="admin-brand">
            <div className="admin-logo">
              💡😎
            </div>

            <div>
              <strong>JUGAAD</strong>
              <span>CONTROL ROOM</span>
            </div>
          </div>

          <nav className="admin-nav">
            <button
              className={
                adminSection === "dashboard"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setAdminSection(
                  "dashboard"
                )
              }
            >
              📊 Dashboard
            </button>

            <button
              className={
                adminSection === "requests"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setAdminSection(
                  "requests"
                )
              }
            >
              📋 Requests
            </button>

            <button
              className={
                adminSection === "matches"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setAdminSection(
                  "matches"
                )
              }
            >
              🤝 Matches
            </button>

            <button
              className={
                adminSection === "users"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setAdminSection(
                  "users"
                )
              }
            >
              👥 Users
            </button>

            <button
              className={
                adminSection === "payments"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setAdminSection(
                  "payments"
                )
              }
            >
              💳 Payments
            </button>

            <button
              className={
                adminSection ===
                "notifications"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setAdminSection(
                  "notifications"
                )
              }
            >
              🔔 Notifications
              {unreadCount > 0 && (
                <span className="nav-badge">
                  {unreadCount}
                </span>
              )}
            </button>
          </nav>

          <div className="admin-sidebar-bottom">
            <div className="admin-user-mini">
              <div className="avatar">
                👨‍💼
              </div>

              <div>
                <strong>
                  {profile?.full_name ||
                    user.email ||
                    "Admin"}
                </strong>

                <span>
                  Administrator
                </span>
              </div>
            </div>

            <button
              className="logout-btn"
              onClick={signOut}
            >
              ↪ Logout
            </button>
          </div>
        </aside>

        <main className="admin-main">
          <header className="admin-topbar">
            <div>
              <h1>
                {adminSection ===
                  "dashboard" &&
                  "Dashboard"}
                {adminSection ===
                  "requests" &&
                  "All Requests"}
                {adminSection ===
                  "matches" &&
                  "Matches"}
                {adminSection ===
                  "users" &&
                  "Users"}
                {adminSection ===
                  "payments" &&
                  "Payments"}
                {adminSection ===
                  "notifications" &&
                  "Notifications"}
              </h1>

              <p>
                JUGAAD control room 😎
              </p>
            </div>

            <div className="admin-top-actions">
              <button
                className="icon-btn"
                onClick={() =>
                  setAdminSection(
                    "notifications"
                  )
                }
              >
                🔔
                {unreadCount > 0 && (
                  <span>
                    {unreadCount}
                  </span>
                )}
              </button>

              <div className="admin-profile">
                <div className="avatar">
                  👨‍💼
                </div>

                <div>
                  <strong>
                    {profile?.full_name ||
                      user.email ||
                      "Admin"}
                  </strong>

                  <small>
                    Administrator
                  </small>
                </div>
              </div>
            </div>
          </header>

          <div className="admin-content">
            {message && (
              <div className="admin-message">
                {message}
                <button
                  onClick={() =>
                    setMessage("")
                  }
                >
                  ×
                </button>
              </div>
            )}

            {adminSection ===
              "dashboard" && (
              <>
                <div className="admin-stats">
                  <div className="stat-card">
                    <span>👥</span>
                    <div>
                      <small>Total Users</small>
                      <strong>
                        {adminStats.totalUsers}
                      </strong>
                    </div>
                  </div>

                  <div className="stat-card">
                    <span>📋</span>
                    <div>
                      <small>Requests</small>
                      <strong>
                        {adminStats.requests}
                      </strong>
                    </div>
                  </div>

                  <div className="stat-card">
                    <span>🤝</span>
                    <div>
                      <small>Matches</small>
                      <strong>
                        {adminStats.matches}
                      </strong>
                    </div>
                  </div>

                  <div className="stat-card">
                    <span>💳</span>
                    <div>
                      <small>Paid Amount</small>
                      <strong>
                        ₹
                        {adminStats.paidAmount.toLocaleString(
                          "en-IN"
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="stat-card">
                    <span>⏳</span>
                    <div>
                      <small>Pending Requests</small>
                      <strong>
                        {
                          adminStats.pendingRequests
                        }
                      </strong>
                    </div>
                  </div>

                  <div className="stat-card">
                    <span>🛠️</span>
                    <div>
                      <small>Active Jobs</small>
                      <strong>
                        {adminStats.activeJobs}
                      </strong>
                    </div>
                  </div>

                  <div className="stat-card">
                    <span>✅</span>
                    <div>
                      <small>Completed</small>
                      <strong>
                        {adminStats.completed}
                      </strong>
                    </div>
                  </div>

                  <div className="stat-card">
                    <span>💰</span>
                    <div>
                      <small>Pending Payments</small>
                      <strong>
                        {
                          adminStats.pendingPayments
                        }
                      </strong>
                    </div>
                  </div>
                </div>

                <section className="admin-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>
                        Recent Requests
                      </h2>
                      <p>
                        Customer ki latest
                        requirements
                      </p>
                    </div>

                    <button
                      className="outline-btn"
                      onClick={() =>
                        setAdminSection(
                          "requests"
                        )
                      }
                    >
                      View All →
                    </button>
                  </div>

                  <div className="request-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Requirement</th>
                          <th>Location</th>
                          <th>Status</th>
                          <th>Date</th>
                        </tr>
                      </thead>

                      <tbody>
                        {requests
                          .slice(0, 8)
                          .map((r) => (
                            <tr key={r.id}>
                              <td>
                                <strong>
                                  {r.need ||
                                    "Requirement"}
                                </strong>

                                <small>
                                  {r.category ||
                                    "Other"}
                                </small>
                              </td>

                              <td>
                                📍{" "}
                                {r.location ||
                                  "Location not given"}
                              </td>

                              <td>
                                <span
                                  className={`status status-${r.status}`}
                                >
                                  {statusLabel(
                                    r.status
                                  )}
                                </span>
                              </td>

                              <td>
                                {formatDate(
                                  r.created_at ||
                                    r.create_at
                                )}
                              </td>
                            </tr>
                          ))}

                        {requests.length ===
                          0 && (
                          <tr>
                            <td
                              colSpan={4}
                              className="empty-cell"
                            >
                              Abhi koi request
                              nahi hai 😴
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {adminSection ===
              "requests" && (
              <section className="admin-panel">
                <div className="panel-heading">
                  <div>
                    <h2>
                      All Customer Requests
                    </h2>
                    <p>
                      Har requirement yahin se
                      manage karo.
                    </p>
                  </div>

                  <div className="toolbar">
                    <input
                      value={adminSearch}
                      onChange={(e) =>
                        setAdminSearch(
                          e.target.value
                        )
                      }
                      placeholder="🔎 Search request..."
                    />

                    <select
                      value={requestFilter}
                      onChange={(e) =>
                        setRequestFilter(
                          e.target.value
                        )
                      }
                    >
                      <option value="all">
                        All Status
                      </option>
                      <option value="pending">
                        Pending
                      </option>
                      <option value="accepted">
                        Accepted
                      </option>
                      <option value="in_progress">
                        In Progress
                      </option>
                      <option value="completed">
                        Completed
                      </option>
                      <option value="cancelled">
                        Cancelled
                      </option>
                    </select>
                  </div>
                </div>

                <div className="request-admin-grid">
                  {filteredAdminRequests.map(
                    (r) => {
                      const customer =
                        r.user_id
                          ? userMap[r.user_id]
                          : null;

                      const provider =
                        r.provider_id
                          ? userMap[
                              r.provider_id
                            ]
                          : null;

                      return (
                        <div
                          className="request-admin-card"
                          key={r.id}
                        >
                          <div className="card-top">
                            <span className="category-chip">
                              {r.category ||
                                "Other"}
                            </span>

                            <span
                              className={`status status-${r.status}`}
                            >
                              {statusLabel(
                                r.status
                              )}
                            </span>
                          </div>

                          <h3>
                            {r.need ||
                              "Requirement"}
                          </h3>

                          <p>
                            📍{" "}
                            {r.location ||
                              "Location not given"}
                          </p>

                          <div className="request-meta">
                            <div>
                              <small>
                                Customer
                              </small>
                              <strong>
                                {customer
                                  ?.full_name ||
                                  r.user_id ||
                                  "Unknown"}
                              </strong>
                            </div>

                            <div>
                              <small>
                                Provider
                              </small>
                              <strong>
                                {provider
                                  ?.full_name ||
                                  r.provider_id ||
                                  "Not assigned"}
                              </strong>
                            </div>

                            <div>
                              <small>
                                Created
                              </small>
                              <strong>
                                {formatDate(
                                  r.created_at ||
                                    r.create_at
                                )}
                              </strong>
                            </div>
                          </div>

                          <div className="card-actions">
                            {r.status ===
                              "pending" && (
                              <button
                                onClick={() =>
                                  updateRequestStatus(
                                    r.id,
                                    "cancelled"
                                  )
                                }
                              >
                                Cancel
                              </button>
                            )}

                            {r.status ===
                              "accepted" && (
                              <button
                                onClick={() =>
                                  updateRequestStatus(
                                    r.id,
                                    "in_progress"
                                  )
                                }
                              >
                                🛠️ Start
                              </button>
                            )}

                            {r.status ===
                              "in_progress" && (
                              <button
                                onClick={() =>
                                  updateRequestStatus(
                                    r.id,
                                    "completed"
                                  )
                                }
                              >
                                ✅ Complete
                              </button>
                            )}

                            {r.status ===
                              "completed" && (
                              <button
                                onClick={() => {
                                  setPaymentRequestId(
                                    r.id
                                  );
                                  setPaymentFormOpen(
                                    true
                                  );
                                }}
                              >
                                💳 Create Payment
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}

                  {filteredAdminRequests.length ===
                    0 && (
                    <div className="empty-state">
                      <div>📭</div>
                      <h3>
                        Koi request nahi mili
                      </h3>
                      <p>
                        Search/filter thoda
                        halka karo 😄
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {adminSection ===
              "matches" && (
              <section className="admin-panel">
                <div className="panel-heading">
                  <div>
                    <h2>
                      All Matches
                    </h2>
                    <p>
                      Customer aur provider
                      connections.
                    </p>
                  </div>
                </div>

                <div className="match-admin-grid">
                  {matches.map((m) => {
                    const request =
                      requestMap[
                        m.request_id
                      ];

                    const provider =
                      m.provider_id ||
                      m.worker_id
                        ? userMap[
                            (m.provider_id ||
                              m.worker_id) as string
                          ]
                        : null;

                    const customer =
                      request?.user_id
                        ? userMap[
                            request.user_id
                          ]
                        : null;

                    const matchStatus =
                      m.status ||
                      m.matches_status ||
                      "pending";

                    return (
                      <div
                        className="match-admin-card"
                        key={m.id}
                      >
                        <div className="match-icon">
                          🤝
                        </div>

                        <div className="match-main">
                          <h3>
                            {request?.need ||
                              "Request"}
                          </h3>

                          <p>
                            📍{" "}
                            {request?.location ||
                              "Location not given"}
                          </p>

                          <div className="match-people">
                            <div>
                              <small>
                                Customer
                              </small>
                              <strong>
                                {customer
                                  ?.full_name ||
                                  "Unknown"}
                              </strong>
                            </div>

                            <div>
                              <small>
                                Provider
                              </small>
                              <strong>
                                {provider
                                  ?.full_name ||
                                  "Unknown"}
                              </strong>
                            </div>
                          </div>
                        </div>

                        <div>
                          <span
                            className={`status status-${matchStatus}`}
                          >
                            {statusLabel(
                              matchStatus
                            )}
                          </span>

                          {m.quoted_amount !=
                            null && (
                            <strong className="match-price">
                              ₹
                              {Number(
                                m.quoted_amount
                              ).toLocaleString(
                                "en-IN"
                              )}
                            </strong>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {matches.length === 0 && (
                    <div className="empty-state">
                      <div>🤝</div>
                      <h3>
                        Abhi match nahi hai
                      </h3>
                    </div>
                  )}
                </div>
              </section>
            )}

            {adminSection ===
              "users" && (
              <section className="admin-panel">
                <div className="panel-heading">
                  <div>
                    <h2>
                      User Management
                    </h2>
                    <p>
                      Customer aur providers
                      manage karo.
                    </p>
                  </div>

                  <div className="toolbar">
                    <input
                      value={adminSearch}
                      onChange={(e) =>
                        setAdminSearch(
                          e.target.value
                        )
                      }
                      placeholder="🔎 Search user..."
                    />
                  </div>
                </div>

                <div className="user-admin-grid">
                  {filteredUsers.map(
                    (u) => (
                      <div
                        className="user-admin-card"
                        key={u.id}
                      >
                        <div className="user-card-head">
                          <div className="big-avatar">
                            {u.avatar_url ? (
                              <img
                                src={
                                  u.avatar_url
                                }
                                alt=""
                              />
                            ) : (
                              "👤"
                            )}
                          </div>

                          <div>
                            <h3>
                              {u.full_name ||
                                "Unnamed User"}
                            </h3>

                            <p>
                              {u.phone ||
                                "Phone not added"}
                            </p>

                            <span className="role-chip">
                              {u.role ||
                                "customer"}
                            </span>
                          </div>
                        </div>

                        <div className="user-info">
                          <div>
                            <small>
                              Verification
                            </small>
                            <strong>
                              {u.is_verified
                                ? "✅ Verified"
                                : "⚠️ Not Verified"}
                            </strong>
                          </div>

                          <div>
                            <small>
                              Status
                            </small>
                            <strong>
                              {u.is_active
                                ? "🟢 Active"
                                : "🔴 Inactive"}
                            </strong>
                          </div>

                          <div>
                            <small>
                              Rating
                            </small>
                            <strong>
                              ⭐{" "}
                              {u.rating ??
                                "—"}
                            </strong>
                          </div>

                          <div>
                            <small>
                              Completed
                            </small>
                            <strong>
                              {u.completed_job ??
                                0}
                            </strong>
                          </div>
                        </div>

                        <div className="user-actions">
                          <select
                            value={
                              u.role ||
                              "customer"
                            }
                            onChange={(e) =>
                              updateUserRole(
                                u.id,
                                e.target.value
                              )
                            }
                            disabled={
                              u.id ===
                              user.id
                            }
                          >
                            <option value="customer">
                              Customer
                            </option>
                            <option value="provider">
                              Provider
                            </option>
                            <option value="worker">
                              Worker
                            </option>
                            <option value="student">
                              Student
                            </option>
                            <option value="government">
                              Government
                            </option>
                          </select>

                          <button
                            onClick={() =>
                              updateUserVerified(
                                u.id,
                                !Boolean(
                                  u.is_verified
                                )
                              )
                            }
                          >
                            {u.is_verified
                              ? "Unverify"
                              : "Verify"}
                          </button>

                          <button
                            onClick={() =>
                              updateUserActive(
                                u.id,
                                !Boolean(
                                  u.is_active
                                )
                              )
                            }
                          >
                            {u.is_active
                              ? "Deactivate"
                              : "Activate"}
                          </button>
                        </div>
                      </div>
                    )
                  )}

                  {filteredUsers.length ===
                    0 && (
                    <div className="empty-state">
                      <div>👥</div>
                      <h3>
                        User nahi mila
                      </h3>
                    </div>
                  )}
                </div>
              </section>
            )}

            {adminSection ===
              "payments" && (
              <section className="admin-panel">
                <div className="panel-heading">
                  <div>
                    <h2>
                      💳 Payment Control Room
                    </h2>
                    <p>
                      Payment queries,
                      verification aur
                      status management.
                    </p>
                  </div>

                  <div className="toolbar">
                    <input
                      value={adminSearch}
                      onChange={(e) =>
                        setAdminSearch(
                          e.target.value
                        )
                      }
                      placeholder="🔎 Search payment..."
                    />

                    <select
                      value={paymentFilter}
                      onChange={(e) =>
                        setPaymentFilter(
                          e.target.value
                        )
                      }
                    >
                      <option value="all">
                        All Payments
                      </option>
                      <option value="pending">
                        Pending
                      </option>
                      <option value="paid">
                        Paid
                      </option>
                      <option value="failed">
                        Failed
                      </option>
                      <option value="refunded">
                        Refunded
                      </option>
                      <option value="cancelled">
                        Cancelled
                      </option>
                    </select>

                    <button
                      className="primary-small-btn"
                      onClick={() =>
                        setPaymentFormOpen(
                          true
                        )
                      }
                    >
                      + New Payment
                    </button>
                  </div>
                </div>

                <div className="payment-summary">
                  <div>
                    <small>
                      Total Queries
                    </small>
                    <strong>
                      {payments.length}
                    </strong>
                  </div>

                  <div>
                    <small>
                      Pending
                    </small>
                    <strong>
                      {
                        adminStats.pendingPayments
                      }
                    </strong>
                  </div>

                  <div>
                    <small>
                      Paid Value
                    </small>
                    <strong>
                      ₹
                      {adminStats.paidAmount.toLocaleString(
                        "en-IN"
                      )}
                    </strong>
                  </div>
                </div>

                <div className="payment-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Payment</th>
                        <th>Customer</th>
                        <th>Provider</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Transaction</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredPayments.map(
                        (p) => {
                          const customer =
                            p.customer_id
                              ? userMap[
                                  p.customer_id
                                ]
                              : null;

                          const provider =
                            p.provider_id
                              ? userMap[
                                  p.provider_id
                                ]
                              : null;

                          return (
                            <tr key={p.id}>
                              <td>
                                <strong>
                                  #
                                  {p.id.slice(
                                    0,
                                    8
                                  )}
                                </strong>

                                <small>
                                  {formatDate(
                                    p.created_at
                                  )}
                                </small>
                              </td>

                              <td>
                                {customer
                                  ?.full_name ||
                                  "—"}
                              </td>

                              <td>
                                {provider
                                  ?.full_name ||
                                  "—"}
                              </td>

                              <td>
                                <strong>
                                  ₹
                                  {Number(
                                    p.amount ||
                                      0
                                  ).toLocaleString(
                                    "en-IN"
                                  )}
                                </strong>
                              </td>

                              <td>
                                {p.payment_method ||
                                  "—"}
                              </td>

                              <td>
                                {p.transaction_id ||
                                  "Not added"}
                              </td>

                              <td>
                                <span
                                  className={`status payment-${p.payment_status}`}
                                >
                                  {paymentLabel(
                                    p.payment_status
                                  )}
                                </span>
                              </td>

                              <td>
                                <div className="payment-actions">
                                  {p.payment_status ===
                                    "pending" && (
                                    <>
                                      <button
                                        onClick={() =>
                                          updatePaymentStatus(
                                            p.id,
                                            "paid"
                                          )
                                        }
                                      >
                                        ✅ Paid
                                      </button>

                                      <button
                                        onClick={() =>
                                          updatePaymentStatus(
                                            p.id,
                                            "failed"
                                          )
                                        }
                                      >
                                        ❌ Fail
                                      </button>
                                    </>
                                  )}

                                  {p.payment_status ===
                                    "paid" && (
                                    <button
                                      onClick={() =>
                                        updatePaymentStatus(
                                          p.id,
                                          "refunded"
                                        )
                                      }
                                    >
                                      ↩️ Refund
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        }
                      )}

                      {filteredPayments.length ===
                        0 && (
                        <tr>
                          <td
                            colSpan={8}
                            className="empty-cell"
                          >
                            Abhi payment query
                            nahi hai 💸
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {adminSection ===
              "notifications" && (
              <section className="admin-panel">
                <div className="panel-heading">
                  <div>
                    <h2>
                      🔔 Notifications
                    </h2>
                    <p>
                      JUGAAD activity alerts.
                    </p>
                  </div>

                  {unreadCount > 0 && (
                    <button
                      className="outline-btn"
                      onClick={
                        markAllNotificationsRead
                      }
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="notification-admin-list">
                  {notifications.map(
                    (n) => (
                      <div
                        className={`notification-admin-card ${
                          n.is_read
                            ? "read"
                            : "unread"
                        }`}
                        key={n.id}
                        onClick={() =>
                          markNotificationRead(
                            n.id
                          )
                        }
                      >
                        <div className="notification-icon">
                          {n.type ===
                          "new_request"
                            ? "🆕"
                            : n.type ===
                              "match_created"
                            ? "🤝"
                            : "🔔"}
                        </div>

                        <div>
                          <strong>
                            {n.title}
                          </strong>

                          <p>
                            {n.message}
                          </p>

                          <small>
                            {formatDate(
                              n.created_at
                            )}
                          </small>
                        </div>

                        {!n.is_read && (
                          <span className="unread-dot" />
                        )}
                      </div>
                    )
                  )}

                  {notifications.length ===
                    0 && (
                    <div className="empty-state">
                      <div>🔔</div>
                      <h3>
                        No notifications
                      </h3>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </main>

        {paymentFormOpen && (
          <div className="modal-backdrop">
            <div className="payment-modal">
              <button
                className="modal-close"
                onClick={() =>
                  setPaymentFormOpen(
                    false
                  )
                }
              >
                ×
              </button>

              <h2>
                💳 New Payment Query
              </h2>

              <p>
                Payment details add karo.
              </p>

              <label>
                Request
                <select
                  value={paymentRequestId}
                  onChange={(e) =>
                    setPaymentRequestId(
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Select request
                  </option>

                  {requests.map((r) => (
                    <option
                      key={r.id}
                      value={r.id}
                    >
                      {r.need ||
                        r.id.slice(
                          0,
                          8
                        )}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Amount ₹
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) =>
                    setPaymentAmount(
                      e.target.value
                    )
                  }
                  placeholder="500"
                />
              </label>

              <label>
                Payment Method
                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(
                      e.target.value
                    )
                  }
                >
                  <option value="UPI">
                    UPI
                  </option>
                  <option value="Cash">
                    Cash
                  </option>
                  <option value="Bank Transfer">
                    Bank Transfer
                  </option>
                  <option value="Other">
                    Other
                  </option>
                </select>
              </label>

              <label>
                Transaction ID / UTR
                <input
                  value={
                    paymentTransactionId
                  }
                  onChange={(e) =>
                    setPaymentTransactionId(
                      e.target.value
                    )
                  }
                  placeholder="UTR / Transaction ID"
                />
              </label>

              <label>
                Notes
                <textarea
                  value={paymentNotes}
                  onChange={(e) =>
                    setPaymentNotes(
                      e.target.value
                    )
                  }
                  placeholder="Payment related note..."
                />
              </label>

              <button
                className="primary-btn"
                disabled={savingPayment}
                onClick={createPayment}
              >
                {savingPayment
                  ? "Saving..."
                  : "💳 Create Payment"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <header className="user-topbar">
        <div className="brand">
          <div className="brand-logo">
            💡😎
          </div>

          <div>
            <strong>JUGAAD</strong>
            <small>
              Har zarurat ka jugaad 🇮🇳
            </small>
          </div>
        </div>

        <div className="top-actions">
          <button
            className="notification-button"
            onClick={() =>
              setShowNotifications(
                !showNotifications
              )
            }
          >
            🔔
            {unreadCount > 0 && (
              <span>
                {unreadCount}
              </span>
            )}
          </button>

          <button
            className="avatar-button"
            onClick={() =>
              setTab("profile")
            }
          >
            👤
          </button>
        </div>

        {showNotifications && (
          <div className="notification-dropdown">
            <div className="dropdown-head">
              <strong>
                Notifications
              </strong>

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

            {notifications
              .slice(0, 8)
              .map((n) => (
                <div
                  key={n.id}
                  className={`notification-item ${
                    n.is_read
                      ? ""
                      : "new"
                  }`}
                  onClick={() =>
                    markNotificationRead(
                      n.id
                    )
                  }
                >
                  <strong>
                    {n.title}
                  </strong>
                  <p>{n.message}</p>
                  <small>
                    {formatDate(
                      n.created_at
                    )}
                  </small>
                </div>
              ))}

            {notifications.length ===
              0 && (
              <div className="notification-empty">
                Abhi koi notification nahi 😴
              </div>
            )}
          </div>
        )}
      </header>

      <main className="user-main">
        {message && (
          <div className="toast">
            {message}
            <button
              onClick={() =>
                setMessage("")
              }
            >
              ×
            </button>
          </div>
        )}

        {tab === "home" && (
          <>
            <section className="hero">
              <div>
                <span className="hero-badge">
                  🇮🇳 Desi Help Network
                </span>

                <h1>
                  Jo chahiye,
                  <br />
                  <span>
                    JUGAAD se milega.
                  </span>
                </h1>

                <p>
                  Koi bhi genuine kaam ho —
                  JUGAAD ko batao. Baaki hum
                  jugaad lagayenge 😎
                </p>
              </div>

              <div className="hero-mascot">
                💡
                <span>😎</span>
              </div>
            </section>

            {isProvider ? (
              <section className="request-box provider-box">
                <div className="section-title">
                  <div>
                    <span>
                      🧰 PROVIDER MODE
                    </span>
                    <h2>
                      Kaunsa kaam pakadna hai?
                    </h2>
                  </div>
                </div>

                <div className="provider-job-list">
                  {providerRequests
                    .filter(
                      (r) =>
                        r.status ===
                          STATUS.pending ||
                        r.provider_id ===
                          user.id
                    )
                    .map((r) => (
                      <div
                        className="job-card"
                        key={r.id}
                      >
                        <div>
                          <span className="category-chip">
                            {r.category ||
                              "Other"}
                          </span>

                          <h3>
                            {r.need}
                          </h3>

                          <p>
                            📍{" "}
                            {r.location ||
                              "Location not given"}
                          </p>
                        </div>

                        <div>
                          {r.provider_id ===
                          user.id ? (
                            <span
                              className={`status status-${r.status}`}
                            >
                              {statusLabel(
                                r.status
                              )}
                            </span>
                          ) : (
                            <button
                              className="primary-small-btn"
                              onClick={() =>
                                acceptRequest(
                                  r.id
                                )
                              }
                            >
                              🔥 Kaam Pakdo
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                  {providerRequests.filter(
                    (r) =>
                      r.status ===
                        STATUS.pending ||
                      r.provider_id ===
                        user.id
                  ).length === 0 && (
                    <div className="empty-state">
                      <div>🛵</div>
                      <h3>
                        Abhi kaam nahi hai
                      </h3>
                      <p>
                        Thoda chai piyo ☕,
                        notification aayega.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            ) : (
              <section className="request-box">
                <div className="section-title">
                  <div>
                    <span>
                      JUGAAD START KARO
                    </span>
                    <h2>
                      Aapko kis cheez ki
                      zarurat hai?
                    </h2>
                  </div>

                  <div className="voice-hint">
                    🎙️
                  </div>
                </div>

                <textarea
                  value={need}
                  onChange={(e) =>
                    setNeed(e.target.value)
                  }
                  placeholder="Jaise: Mujhe electrician chahiye, cooler kharab hai..."
                  rows={4}
                />

                <div className="category-row">
                  {categories.map(
                    (item) => (
                      <button
                        key={item}
                        className={
                          category ===
                          item
                            ? "selected"
                            : ""
                        }
                        onClick={() =>
                          setCategory(
                            item
                          )
                        }
                      >
                        {item}
                      </button>
                    )
                  )}
                </div>

                <div className="location-input">
                  <span>📍</span>
                  <input
                    value={location}
                    onChange={(e) =>
                      setLocation(
                        e.target.value
                      )
                    }
                    placeholder={
                      profile?.preferred_address ||
                      "Location batao"
                    }
                  />
                </div>

                <button
                  className="primary-btn large"
                  disabled={
                    savingRequest
                  }
                  onClick={
                    createRequest
                  }
                >
                  {savingRequest
                    ? "JUGAAD lag raha hai..."
                    : "JUGAAD Karo →"}
                </button>
              </section>
            )}

            <section className="services-section">
              <div className="section-title">
                <div>
                  <span>
                    POPULAR JUGAAD
                  </span>
                  <h2>
                    Log kya mangwa rahe hain?
                  </h2>
                </div>

                <button
                  className="text-btn"
                  onClick={() =>
                    setTab("explore")
                  }
                >
                  Sab dekho →
                </button>
              </div>

              <div className="service-grid">
                {services.map(
                  (service) => (
                    <button
                      className="service-card"
                      key={service.name}
                      onClick={() =>
                        useService(
                          service.name
                        )
                      }
                    >
                      <span>
                        {service.icon}
                      </span>

                      <strong>
                        {service.name}
                      </strong>

                      <small>
                        JUGAAD available
                        🛵
                      </small>
                    </button>
                  )
                )}
              </div>
            </section>
          </>
        )}

        {tab === "explore" && (
          <section className="page-section">
            <div className="page-heading">
              <span>
                🔎 EXPLORE
              </span>
              <h1>
                Kis cheez ka JUGAAD chahiye?
              </h1>
              <p>
                Category choose karo ya
                seedha requirement likho.
              </p>
            </div>

            <div className="explore-grid">
              {services.map(
                (service) => (
                  <button
                    className="explore-card"
                    key={service.name}
                    onClick={() =>
                      useService(
                        service.name
                      )
                    }
                  >
                    <span>
                      {service.icon}
                    </span>
                    <h3>
                      {service.name}
                    </h3>
                    <p>
                      {service.category}
                    </p>
                    <strong>
                      JUGAAD Karo →
                    </strong>
                  </button>
                )
              )}
            </div>
          </section>
        )}

        {tab === "requests" && (
          <section className="page-section">
            <div className="page-heading">
              <span>
                📋 MERI REQUESTS
              </span>
              <h1>
                Aapke saare JUGAAD
              </h1>
              <p>
                Kaam kaha tak pahucha,
                yahin dikhega.
              </p>
            </div>

            <div className="customer-request-list">
              {customerRequests.map(
                (r) => {
                  const match =
                    matches.find(
                      (m) =>
                        m.request_id ===
                        r.id
                    );

                  const providerId =
                    match?.provider_id ||
                    match?.worker_id ||
                    r.provider_id;

                  const provider =
                    providerId
                      ? users.find(
                          (u) =>
                            u.id ===
                            providerId
                        )
                      : null;

                  return (
                    <div
                      className="customer-request-card"
                      key={r.id}
                    >
                      <div className="request-card-head">
                        <span className="category-chip">
                          {r.category ||
                            "Other"}
                        </span>

                        <span
                          className={`status status-${r.status}`}
                        >
                          {statusLabel(
                            r.status
                          )}
                        </span>
                      </div>

                      <h3>
                        {r.need}
                      </h3>

                      <p>
                        📍{" "}
                        {r.location ||
                          "Location not given"}
                      </p>

                      {provider && (
                        <div className="provider-found">
                          <div className="provider-avatar">
                            👨‍🔧
                          </div>

                          <div>
                            <small>
                              JUGAAD mil gaya
                            </small>
                            <strong>
                              {
                                provider.full_name
                              }
                            </strong>
                            <span>
                              ⭐{" "}
                              {provider.rating ??
                                "New Provider"}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="request-card-bottom">
                        <small>
                          {formatDate(
                            r.created_at ||
                              r.create_at
                          )}
                        </small>

                        {r.status ===
                          "accepted" && (
                          <button
                            onClick={() =>
                              updateRequestStatus(
                                r.id,
                                "in_progress"
                              )
                            }
                          >
                            🛵 Kaam Start
                          </button>
                        )}

                        {r.status ===
                          "in_progress" && (
                          <button
                            onClick={() =>
                              updateRequestStatus(
                                r.id,
                                "completed"
                              )
                            }
                          >
                            ✅ Kaam Complete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }
              )}

              {customerRequests.length ===
                0 && (
                <div className="empty-state">
                  <div>💡</div>
                  <h3>
                    Abhi koi JUGAAD nahi
                  </h3>
                  <p>
                    Pehla kaam batao, hum
                    jugaad lagate hain 😎
                  </p>

                  <button
                    className="primary-btn"
                    onClick={() =>
                      setTab("home")
                    }
                  >
                    JUGAAD Karo →
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {tab === "profile" && (
          <section className="page-section">
            <div className="page-heading">
              <span>
                👤 PROFILE
              </span>
              <h1>
                Apna JUGAAD profile
              </h1>
              <p>
                Details save karo taaki
                kaam aur smooth ho.
              </p>
            </div>

            <div className="profile-card">
              <div className="profile-avatar">
                👤
              </div>

              <div className="profile-form">
                <label>
                  Full Name
                  <input
                    value={profileName}
                    onChange={(e) =>
                      setProfileName(
                        e.target.value
                      )
                    }
                    placeholder="Aapka naam"
                  />
                </label>

                <label>
                  Phone
                  <input
                    value={profilePhone}
                    onChange={(e) =>
                      setProfilePhone(
                        e.target.value
                      )
                    }
                    placeholder="+91..."
                  />
                </label>

                <label>
                  Preferred Address
                  <textarea
                    value={profileAddress}
                    onChange={(e) =>
                      setProfileAddress(
                        e.target.value
                      )
                    }
                    placeholder="Aapka address"
                  />
                </label>

                <div className="profile-role">
                  <small>
                    Current Mode
                  </small>

                  <strong>
                    {role}
                  </strong>
                </div>

                <button
                  className="primary-btn"
                  disabled={
                    savingProfile
                  }
                  onClick={
                    saveProfile
                  }
                >
                  {savingProfile
                    ? "Saving..."
                    : "💾 Profile Save"}
                </button>

                {!isProvider && (
                  <button
                    className="secondary-btn"
                    onClick={
                      switchToProvider
                    }
                  >
                    🧰 Provider Bano
                  </button>
                )}

                {isProvider && (
                  <button
                    className="secondary-btn"
                    onClick={
                      switchToCustomer
                    }
                  >
                    🙋 Customer Mode
                  </button>
                )}

                <button
                  className="danger-btn"
                  onClick={signOut}
                >
                  ↪ Logout
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      <nav className="bottom-nav">
        <button
          className={
            tab === "home"
              ? "active"
              : ""
          }
          onClick={() =>
            setTab("home")
          }
        >
          <span>🏠</span>
          Home
        </button>

        <button
          className={
            tab === "explore"
              ? "active"
              : ""
          }
          onClick={() =>
            setTab("explore")
          }
        >
          <span>🔎</span>
          Explore
        </button>

        <button
          className={
            tab === "requests"
              ? "active"
              : ""
          }
          onClick={() =>
            setTab("requests")
          }
        >
          <span>📋</span>
          Requests
        </button>

        <button
          className={
            tab === "profile"
              ? "active"
              : ""
          }
          onClick={() =>
            setTab("profile")
          }
        >
          <span>👤</span>
          Profile
        </button>
      </nav>
    </div>
  );
}
