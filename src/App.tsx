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
  platform_fee: number;
  provider_amount: number;
  payment_method?: string | null;
  payment_gateway?: string | null;
  transaction_id?: string | null;
  payment_status: string;
  refund_status: string;
  refund_amount: number;
  payout_status: string;
  paid_at?: string | null;
  refunded_at?: string | null;
  payout_at?: string | null;
  notes?: string | null;
  created_at: string;
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
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function money(value?: number | null) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function shortId(value?: string | null) {
  if (!value) return "—";
  return value.length > 12
    ? `${value.slice(0, 8)}...${value.slice(-4)}`
    : value;
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

function paymentStatusLabel(status?: string | null) {
  switch (status) {
    case "paid":
      return "✅ Paid";
    case "processing":
      return "🔄 Processing";
    case "pending":
      return "⏳ Pending";
    case "failed":
      return "❌ Failed";
    case "cancelled":
      return "🚫 Cancelled";
    case "refunded":
      return "↩️ Refunded";
    case "partially_refunded":
      return "↩️ Partial Refund";
    default:
      return status || "Unknown";
  }
}

function roleLabel(role?: string | null) {
  switch (String(role || "").toLowerCase()) {
    case "admin":
      return "👑 Admin";
    case "provider":
      return "🧰 Provider";
    case "worker":
      return "🧰 Worker";
    case "student":
      return "🎓 Student";
    case "government":
      return "🏛️ Government";
    default:
      return "🧑 Customer";
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
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const [showNotifications, setShowNotifications] = useState(false);
  const [message, setMessage] = useState("");

  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminFilter, setAdminFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] =
    useState<RequestRow | null>(null);
  const [selectedMatch, setSelectedMatch] =
    useState<MatchRow | null>(null);
  const [selectedPayment, setSelectedPayment] =
    useState<PaymentRow | null>(null);

  const role = String(profile?.role || "customer").toLowerCase();

  const isAdmin =
    role === "admin" ||
    role === "super_admin";

  const isProvider =
    role === "provider" ||
    role === "worker" ||
    role === "service_provider";

  const unreadCount =
    notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (!user) return;

    loadProfile(user.id);
    loadNotifications(user.id);

    const notificationChannel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadNotifications(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationChannel);
    };
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

  useEffect(() => {
    if (!user || !profile || !isAdmin) return;

    const requestsChannel = supabase
      .channel("admin-requests-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "requests",
        },
        () => {
          loadAdminData();
        }
      )
      .subscribe();

    const matchesChannel = supabase
      .channel("admin-matches-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
        },
        () => {
          loadAdminData();
        }
      )
      .subscribe();

    const paymentsChannel = supabase
      .channel("admin-payments-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
        },
        () => {
          loadAdminData();
        }
      )
      .subscribe();

    const profilesChannel = supabase
      .channel("admin-profiles-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
        },
        () => {
          loadAdminData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(requestsChannel);
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(paymentsChannel);
      supabase.removeChannel(profilesChannel);
    };
  }, [user, profile, isAdmin]);

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
    setProfiles([]);
    setPayments([]);
    setTab("home");
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
      setMessage(error.message);
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
      .select("*")
      .order("created_at", {
        ascending: false,
      });

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
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(error);
      return;
    }

    setNotifications(data || []);
  }

  async function loadAdminData() {
    if (!user || !isAdmin) return;

    setAdminLoading(true);

    const [
      requestResult,
      matchResult,
      profileResult,
      paymentResult,
    ] = await Promise.all([
      supabase
        .from("requests")
        .select("*")
        .order("created_at", {
          ascending: false,
        }),

      supabase
        .from("matches")
        .select("*")
        .order("created_at", {
          ascending: false,
        }),

      supabase
        .from("profiles")
        .select("*")
        .order("created_at", {
          ascending: false,
        }),

      supabase
        .from("payments")
        .select("*")
        .order("created_at", {
          ascending: false,
        }),
    ]);

    if (requestResult.error) {
      console.error(requestResult.error);
    } else {
      setRequests(requestResult.data || []);
    }

    if (matchResult.error) {
      console.error(matchResult.error);
    } else {
      setMatches(matchResult.data || []);
    }

    if (profileResult.error) {
      console.error(profileResult.error);
    } else {
      setProfiles(profileResult.data || []);
    }

    if (paymentResult.error) {
      console.error(paymentResult.error);
    } else {
      setPayments(paymentResult.data || []);
    }

    setAdminLoading(false);
  }

  async function createRequest() {
    if (!user) {
      setMessage("Pehle Google se login karo 😄");
      return;
    }

    const cleanNeed = need.trim();

    if (!cleanNeed) {
      setMessage(
        "Bhai, pehle batao kya jugaad chahiye 😄"
      );
      return;
    }

    setSavingRequest(true);
    setMessage("");

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
      setMessage(error.message);
      return;
    }

    setNeed("");
    setLocation("");
    setCategory("Sab");

    setMessage(
      "🎉 JUGAAD nikal pada! Kaam dhoondh raha hai."
    );

    await loadRequests();
    setTab("requests");
  }

  async function acceptRequest(
    requestId: string
  ) {
    if (!user) return;

    setMessage("");

    const { data: existing, error: matchError } =
      await supabase
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
        setMessage(
          "Match create nahi hua: " +
            error.message
        );
        return;
      }
    }

    const { error: requestError } =
      await supabase
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

    setMessage(
      "🔥 Kaam pakad liya! Customer ko bata diya."
    );

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

    if (isAdmin) {
      await loadAdminData();
    }
  }

  async function adminUpdateRequestStatus(
    requestId: string,
    status: string
  ) {
    const { error } = await supabase
      .from("requests")
      .update({ status })
      .eq("id", requestId);

    if (error) {
      setMessage(
        "Request update nahi hua: " +
          error.message
      );
      return;
    }

    setMessage(
      `📋 Request ${status} kar di gayi.`
    );

    await loadAdminData();
  }

  async function adminUpdateUser(
    profileId: string,
    changes: Partial<Profile>
  ) {
    const { error } = await supabase
      .from("profiles")
      .update(changes)
      .eq("id", profileId);

    if (error) {
      setMessage(
        "User update nahi hua: " +
          error.message
      );
      return;
    }

    setMessage("👤 User update ho gaya.");
    await loadAdminData();
  }

  async function saveProfile() {
    if (!user) return;

    setSavingProfile(true);
    setMessage("");

    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        full_name:
          profileName.trim() || null,
        phone:
          profilePhone.trim() || null,
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

    setMessage(
      "🧰 Provider mode ON! Ab kaam pakdo."
    );
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

  async function markNotificationRead(
    id: string
  ) {
    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
      })
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
      .update({
        is_read: true,
      })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadNotifications(user.id);
  }

  async function adminPaymentStatus(
    paymentId: string,
    status: string
  ) {
    const { error } = await supabase.rpc(
      "admin_update_payment_status",
      {
        p_payment_id: paymentId,
        p_status: status,
        p_notes: null,
      }
    );

    if (error) {
      setMessage(
        "Payment update failed: " +
          error.message
      );
      return;
    }

    setMessage(
      `💳 Payment ${status} kar di gayi.`
    );

    setSelectedPayment(null);
    await loadAdminData();
  }

  async function adminRefund(
    payment: PaymentRow
  ) {
    const amount = window.prompt(
      `Refund amount enter karo. Maximum ${money(
        payment.amount
      )}`,
      String(payment.amount)
    );

    if (amount === null) return;

    const refundAmount = Number(amount);

    if (
      !Number.isFinite(refundAmount) ||
      refundAmount <= 0 ||
      refundAmount > Number(payment.amount)
    ) {
      setMessage("❌ Invalid refund amount.");
      return;
    }

    const { error } = await supabase.rpc(
      "admin_refund_payment",
      {
        p_payment_id: payment.id,
        p_refund_amount: refundAmount,
        p_notes: "Admin refund",
      }
    );

    if (error) {
      setMessage(
        "Refund failed: " +
          error.message
      );
      return;
    }

    setMessage(
      `↩️ ${money(
        refundAmount
      )} refund mark kar diya.`
    );

    setSelectedPayment(null);
    await loadAdminData();
  }

  async function adminPayout(
    paymentId: string,
    status: string
  ) {
    const { error } = await supabase.rpc(
      "admin_update_payout",
      {
        p_payment_id: paymentId,
        p_payout_status: status,
      }
    );

    if (error) {
      setMessage(
        "Payout update failed: " +
          error.message
      );
      return;
    }

    setMessage(
      `💸 Provider payout ${status}.`
    );

    await loadAdminData();
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

  const adminStats = useMemo(() => {
    const customers = profiles.filter(
      (p) =>
        String(p.role).toLowerCase() ===
        "customer"
    ).length;

    const providers = profiles.filter(
      (p) =>
        ["provider", "worker", "service_provider"].includes(
          String(p.role).toLowerCase()
        )
    ).length;

    const activeUsers = profiles.filter(
      (p) => p.is_active === true
    ).length;

    const pendingRequests =
      requests.filter(
        (r) => r.status === STATUS.pending
      ).length;

    const acceptedRequests =
      requests.filter(
        (r) => r.status === STATUS.accepted
      ).length;

    const progressRequests =
      requests.filter(
        (r) =>
          r.status === STATUS.in_progress
      ).length;

    const completedRequests =
      requests.filter(
        (r) => r.status === STATUS.completed
      ).length;

    const paidPayments =
      payments.filter(
        (p) =>
          p.payment_status === "paid"
      );

    const totalCollected =
      paidPayments.reduce(
        (sum, p) =>
          sum + Number(p.amount || 0),
        0
      );

    const platformEarnings =
      paidPayments.reduce(
        (sum, p) =>
          sum +
          Number(p.platform_fee || 0),
        0
      );

    const providerPayable =
      paidPayments.reduce(
        (sum, p) =>
          sum +
          Number(
            p.provider_amount || 0
          ),
        0
      );

    return {
      users: profiles.length,
      customers,
      providers,
      activeUsers,
      requests: requests.length,
      pendingRequests,
      acceptedRequests,
      progressRequests,
      completedRequests,
      matches: matches.length,
      notifications: notifications.length,
      unreadNotifications: unreadCount,
      payments: payments.length,
      paidPayments: paidPayments.length,
      totalCollected,
      platformEarnings,
      providerPayable,
    };
  }, [
    profiles,
    requests,
    matches,
    notifications,
    payments,
    unreadCount,
  ]);

  const filteredUsers = useMemo(() => {
    const search =
      adminSearch.trim().toLowerCase();

    return profiles.filter((p) => {
      const roleMatch =
        adminFilter === "all" ||
        String(p.role || "").toLowerCase() ===
          adminFilter;

      if (!roleMatch) return false;

      if (!search) return true;

      return (
        String(p.full_name || "")
          .toLowerCase()
          .includes(search) ||
        String(p.phone || "")
          .toLowerCase()
          .includes(search) ||
        String(p.role || "")
          .toLowerCase()
          .includes(search) ||
        p.id.toLowerCase().includes(search)
      );
    });
  }, [
    profiles,
    adminSearch,
    adminFilter,
  ]);

  const filteredRequests = useMemo(() => {
    const search =
      adminSearch.trim().toLowerCase();

    return requests.filter((r) => {
      if (!search) return true;

      return (
        String(r.need || "")
          .toLowerCase()
          .includes(search) ||
        String(r.category || "")
          .toLowerCase()
          .includes(search) ||
        String(r.location || "")
          .toLowerCase()
          .includes(search) ||
        String(r.status || "")
          .toLowerCase()
          .includes(search)
      );
    });
  }, [requests, adminSearch]);

  const filteredPayments = useMemo(() => {
    const search =
      adminSearch.trim().toLowerCase();

    return payments.filter((p) => {
      if (!search) return true;

      return (
        String(p.transaction_id || "")
          .toLowerCase()
          .includes(search) ||
        String(p.payment_status || "")
          .toLowerCase()
          .includes(search) ||
        String(p.payment_method || "")
          .toLowerCase()
          .includes(search) ||
        String(p.customer_id || "")
          .toLowerCase()
          .includes(search) ||
        String(p.provider_id || "")
          .toLowerCase()
          .includes(search)
      );
    });
  }, [payments, adminSearch]);

  function userName(id?: string | null) {
    if (!id) return "Not assigned";

    const found = profiles.find(
      (p) => p.id === id
    );

    return (
      found?.full_name ||
      found?.phone ||
      shortId(id)
    );
  }

  if (loading) {
    return (
      <div className="loadingScreen">
        <div className="mascot">💡😎</div>
        <h2>JUGAAD lag raha hai...</h2>
        <p>
          Thoda ruk bhai, jugaad start ho raha hai 😄
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="loginScreen">
        <div className="logoBox">
          💡😎
        </div>

        <h1>JUGAAD</h1>

        <p className="tagline">
          Har zarurat ka jugaad 🇮🇳
        </p>

        <h2>
          Jo chahiye, JUGAAD se milega
        </h2>

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

  /* =====================================================
     ADMIN
     ===================================================== */

  if (isAdmin) {
    const adminTitle =
      tab === "admin"
        ? "Dashboard"
        : tab === "adminUsers"
        ? "Users"
        : tab === "adminRequests"
        ? "Requests"
        : tab === "adminMatches"
        ? "Matches"
        : tab === "adminPayments"
        ? "Payments"
        : "Notifications";

    return (
      <div className="adminShell">
        <aside className="adminSidebar">
          <div className="adminLogo">
            <span>💡😎</span>
            <b>JUGAAD</b>
          </div>

          <div className="adminTitle">
            Admin Control Room
          </div>

          <button
            className={
              tab === "admin"
                ? "sideButton active"
                : "sideButton"
            }
            onClick={() => {
              setTab("admin");
              setAdminSearch("");
            }}
          >
            📊 Dashboard
          </button>

          <button
            className={
              tab === "adminUsers"
                ? "sideButton active"
                : "sideButton"
            }
            onClick={() => {
              setTab("adminUsers");
              setAdminSearch("");
            }}
          >
            👥 Users
          </button>

          <button
            className={
              tab === "adminRequests"
                ? "sideButton active"
                : "sideButton"
            }
            onClick={() => {
              setTab("adminRequests");
              setAdminSearch("");
            }}
          >
            📋 Requests
          </button>

          <button
            className={
              tab === "adminMatches"
                ? "sideButton active"
                : "sideButton"
            }
            onClick={() => {
              setTab("adminMatches");
              setAdminSearch("");
            }}
          >
            🤝 Matches
          </button>

          <button
            className={
              tab === "adminPayments"
                ? "sideButton active"
                : "sideButton"
            }
            onClick={() => {
              setTab("adminPayments");
              setAdminSearch("");
            }}
          >
            💰 Payments
          </button>

          <button
            className={
              tab === "adminNotifications"
                ? "sideButton active"
                : "sideButton"
            }
            onClick={() =>
              setTab("adminNotifications")
            }
          >
            🔔 Notifications
            {unreadCount > 0 && (
              <span className="sideBadge">
                {unreadCount}
              </span>
            )}
          </button>

          <div className="sidebarBottom">
            <div className="adminSidebarProfile">
              <div className="avatar">
                👨‍💼
              </div>

              <div>
                <b>
                  {profile?.full_name ||
                    user.email ||
                    "Admin"}
                </b>

                <small>
                  Administrator
                </small>
              </div>
            </div>

            <button
              className="logoutButton"
              onClick={logout}
            >
              🚪 Logout
            </button>
          </div>
        </aside>

        <main className="adminMain">
          <div className="adminTopbar">
            <div>
              <h1>{adminTitle}</h1>
              <p>
                JUGAAD control room 😎
              </p>
            </div>

            <div className="adminTopActions">
              <button
                className="refreshAdmin"
                onClick={loadAdminData}
              >
                {adminLoading
                  ? "Refreshing..."
                  : "↻ Refresh"}
              </button>

              <button
                className="adminUser"
                onClick={() =>
                  setTab("adminNotifications")
                }
              >
                <div className="avatar">
                  👨‍💼
                </div>

                <div>
                  <b>
                    {profile?.full_name ||
                      user.email ||
                      "Admin"}
                  </b>

                  <small>
                    {unreadCount > 0
                      ? `🔔 ${unreadCount} new`
                      : "Administrator"}
                  </small>
                </div>
              </button>
            </div>
          </div>

          {message && (
            <div className="messageBox">
              {message}
            </div>
          )}

          {/* ================= DASHBOARD ================= */}

          {tab === "admin" && (
            <>
              <div className="statsGrid">
                <div className="statCard">
                  <span>👥</span>
                  <small>Total Users</small>
                  <strong>
                    {adminStats.users}
                  </strong>
                  <em>
                    {adminStats.activeUsers} active
                  </em>
                </div>

                <div className="statCard">
                  <span>📋</span>
                  <small>Total Requests</small>
                  <strong>
                    {adminStats.requests}
                  </strong>
                  <em>
                    {adminStats.pendingRequests} pending
                  </em>
                </div>

                <div className="statCard">
                  <span>🤝</span>
                  <small>Total Matches</small>
                  <strong>
                    {adminStats.matches}
                  </strong>
                  <em>
                    {adminStats.acceptedRequests} accepted
                  </em>
                </div>

                <div className="statCard">
                  <span>💰</span>
                  <small>Total Collected</small>
                  <strong>
                    {money(
                      adminStats.totalCollected
                    )}
                  </strong>
                  <em>
                    {adminStats.paidPayments} paid
                  </em>
                </div>
              </div>

              <div className="statsGrid">
                <div className="statCard">
                  <span>🧑</span>
                  <small>Customers</small>
                  <strong>
                    {adminStats.customers}
                  </strong>
                </div>

                <div className="statCard">
                  <span>🧰</span>
                  <small>Providers</small>
                  <strong>
                    {adminStats.providers}
                  </strong>
                </div>

                <div className="statCard">
                  <span>🔔</span>
                  <small>Unread Alerts</small>
                  <strong>
                    {adminStats.unreadNotifications}
                  </strong>
                </div>

                <div className="statCard">
                  <span>💸</span>
                  <small>JUGAAD Earnings</small>
                  <strong>
                    {money(
                      adminStats.platformEarnings
                    )}
                  </strong>
                </div>
              </div>

              <section className="adminPanel">
                <div className="panelHeader">
                  <div>
                    <h2>⚡ Live Overview</h2>
                    <p>
                      Abhi JUGAAD mein kya chal raha hai
                    </p>
                  </div>

                  <button
                    onClick={loadAdminData}
                  >
                    Update ↻
                  </button>
                </div>

                <div className="adminOverviewGrid">
                  <div className="overviewBox">
                    <b>📋 Requests</b>
                    <span>
                      {adminStats.pendingRequests} Pending
                    </span>
                    <span>
                      {adminStats.acceptedRequests} Accepted
                    </span>
                    <span>
                      {adminStats.progressRequests} In Progress
                    </span>
                    <span>
                      {adminStats.completedRequests} Completed
                    </span>
                  </div>

                  <div className="overviewBox">
                    <b>💰 Payments</b>
                    <span>
                      {payments.filter(
                        (p) =>
                          p.payment_status ===
                          "pending"
                      ).length}{" "}
                      Pending
                    </span>
                    <span>
                      {adminStats.paidPayments} Paid
                    </span>
                    <span>
                      {payments.filter(
                        (p) =>
                          p.payment_status ===
                          "failed"
                      ).length}{" "}
                      Failed
                    </span>
                    <span>
                      {money(
                        adminStats.providerPayable
                      )}{" "}
                      Provider payable
                    </span>
                  </div>

                  <div className="overviewBox">
                    <b>👥 Users</b>
                    <span>
                      {adminStats.customers} Customers
                    </span>
                    <span>
                      {adminStats.providers} Providers
                    </span>
                    <span>
                      {adminStats.activeUsers} Active
                    </span>
                    <span>
                      {adminStats.users -
                        adminStats.activeUsers}{" "}
                      Inactive
                    </span>
                  </div>
                </div>
              </section>

              <section className="adminPanel">
                <div className="panelHeader">
                  <div>
                    <h2>📋 Recent Requests</h2>
                    <p>
                      Latest customer requirements
                    </p>
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
                          <th>Customer</th>
                          <th>Location</th>
                          <th>Status</th>
                          <th>Date</th>
                        </tr>
                      </thead>

                      <tbody>
                        {requests
                          .slice(0, 10)
                          .map((request) => (
                            <tr
                              key={request.id}
                              onClick={() =>
                                setSelectedRequest(
                                  request
                                )
                              }
                            >
                              <td>
                                <b>
                                  {request.need ||
                                    "No description"}
                                </b>
                              </td>

                              <td>
                                {userName(
                                  request.user_id
                                )}
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

          {/* ================= USERS ================= */}

          {tab === "adminUsers" && (
            <section className="adminPanel">
              <div className="panelHeader">
                <div>
                  <h2>
                    👥 JUGAAD Users
                  </h2>

                  <p>
                    {filteredUsers.length} users found
                  </p>
                </div>
              </div>

              <div className="adminFilters">
                <input
                  value={adminSearch}
                  onChange={(e) =>
                    setAdminSearch(
                      e.target.value
                    )
                  }
                  placeholder="🔎 Name, phone, role ya ID search..."
                />

                <select
                  value={adminFilter}
                  onChange={(e) =>
                    setAdminFilter(
                      e.target.value
                    )
                  }
                >
                  <option value="all">
                    Sab Users
                  </option>
                  <option value="customer">
                    Customers
                  </option>
                  <option value="provider">
                    Providers
                  </option>
                  <option value="worker">
                    Workers
                  </option>
                  <option value="admin">
                    Admins
                  </option>
                </select>
              </div>

              {filteredUsers.length === 0 ? (
                <div className="emptyState">
                  👤 Koi user nahi mila.
                </div>
              ) : (
                <div className="userAdminGrid">
                  {filteredUsers.map((p) => (
                    <div
                      className="userAdminCard"
                      key={p.id}
                    >
                      <div className="userCardHead">
                        <div className="bigAvatar">
                          {p.avatar_url ? (
                            <img
                              src={p.avatar_url}
                              alt=""
                            />
                          ) : (
                            "👤"
                          )}
                        </div>

                        <div>
                          <h3>
                            {p.full_name ||
                              "JUGAAD User"}
                          </h3>

                          <span className="roleBadge">
                            {roleLabel(p.role)}
                          </span>
                        </div>
                      </div>

                      <div className="userInfo">
                        <p>
                          📱{" "}
                          {p.phone ||
                            "Phone not added"}
                        </p>

                        <p>
                          📍{" "}
                          {p.preferred_address ||
                            p.service_area ||
                            "Address not added"}
                        </p>

                        <p>
                          ⭐{" "}
                          {p.rating ?? 0} &nbsp; | &nbsp;
                          🛠️{" "}
                          {p.completed_job ?? 0} jobs
                        </p>
                      </div>

                      <div className="userStatusRow">
                        <span
                          className={
                            p.is_active
                              ? "statusPill success"
                              : "statusPill"
                          }
                        >
                          {p.is_active
                            ? "🟢 Active"
                            : "🔴 Inactive"}
                        </span>

                        {String(
                          p.role || ""
                        ).toLowerCase() ===
                          "provider" && (
                          <span className="statusPill">
                            {p.is_verified
                              ? "✅ Verified"
                              : "⚠️ Unverified"}
                          </span>
                        )}
                      </div>

                      <div className="adminCardActions">
                        <button
                          onClick={() =>
                            adminUpdateUser(
                              p.id,
                              {
                                is_active:
                                  !p.is_active,
                              }
                            )
                          }
                        >
                          {p.is_active
                            ? "🔴 Deactivate"
                            : "🟢 Activate"}
                        </button>

                        {[
                          "provider",
                          "worker",
                        ].includes(
                          String(
                            p.role || ""
                          ).toLowerCase()
                        ) && (
                          <button
                            onClick={() =>
                              adminUpdateUser(
                                p.id,
                                {
                                  is_verified:
                                    !p.is_verified,
                                }
                              )
                            }
                          >
                            {p.is_verified
                              ? "❌ Unverify"
                              : "✅ Verify"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ================= REQUESTS ================= */}

          {tab === "adminRequests" && (
            <section className="adminPanel">
              <div className="panelHeader">
                <div>
                  <h2>
                    📋 All Requests
                  </h2>

                  <p>
                    Customer ki sari requirements
                  </p>
                </div>
              </div>

              <div className="adminFilters">
                <input
                  value={adminSearch}
                  onChange={(e) =>
                    setAdminSearch(
                      e.target.value
                    )
                  }
                  placeholder="🔎 Requirement, category, location..."
                />
              </div>

              {filteredRequests.length === 0 ? (
                <div className="emptyState">
                  📭 Koi request nahi.
                </div>
              ) : (
                <div className="requestAdminGrid">
                  {filteredRequests.map(
                    (request) => (
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
                          👤{" "}
                          {userName(
                            request.user_id
                          )}
                        </p>

                        <p>
                          📍{" "}
                          {request.location ||
                            "Location not given"}
                        </p>

                        {request.provider_id && (
                          <p>
                            🧰 Provider:{" "}
                            {userName(
                              request.provider_id
                            )}
                          </p>
                        )}

                        <small>
                          {formatDate(
                            request.created_at ||
                              request.create_at
                          )}
                        </small>

                        <div className="adminCardActions">
                          <button
                            onClick={() =>
                              setSelectedRequest(
                                request
                              )
                            }
                          >
                            👁️ Details
                          </button>

                          <select
                            value={
                              request.status ||
                              STATUS.pending
                            }
                            onChange={(e) =>
                              adminUpdateRequestStatus(
                                request.id,
                                e.target.value
                              )
                            }
                          >
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
                    )
                  )}
                </div>
              )}
            </section>
          )}

          {/* ================= MATCHES ================= */}

          {tab === "adminMatches" && (
            <section className="adminPanel">
              <div className="panelHeader">
                <div>
                  <h2>
                    🤝 Matches
                  </h2>

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
                  {matches.map((match) => {
                    const request =
                      requests.find(
                        (r) =>
                          r.id ===
                          match.request_id
                      );

                    const providerId =
                      match.provider_id ||
                      match.worker_id;

                    return (
                      <div
                        className="adminRequestCard"
                        key={match.id}
                      >
                        <div className="cardTop">
                          <span className="categoryTag">
                            🤝 Match
                          </span>

                          <span className="statusPill">
                            {match.status ||
                              match.matches_status ||
                              "accepted"}
                          </span>
                        </div>

                        <h3>
                          {request?.need ||
                            "JUGAAD Request"}
                        </h3>

                        <p>
                          👤 Customer:{" "}
                          <b>
                            {userName(
                              request?.user_id
                            )}
                          </b>
                        </p>

                        <p>
                          🧰 Provider:{" "}
                          <b>
                            {userName(
                              providerId
                            )}
                          </b>
                        </p>

                        {match.quoted_amount !=
                          null && (
                          <p>
                            💰 Quote:{" "}
                            <b>
                              {money(
                                match.quoted_amount
                              )}
                            </b>
                          </p>
                        )}

                        {match.distance_km !=
                          null && (
                          <p>
                            📍 Distance:{" "}
                            {
                              match.distance_km
                            }{" "}
                            km
                          </p>
                        )}

                        <small>
                          {formatDate(
                            match.created_at
                          )}
                        </small>

                        <div className="adminCardActions">
                          <button
                            onClick={() =>
                              setSelectedMatch(
                                match
                              )
                            }
                          >
                            👁️ Full Details
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ================= PAYMENTS ================= */}

          {tab === "adminPayments" && (
            <section className="adminPanel">
              <div className="panelHeader">
                <div>
                  <h2>
                    💰 Payment Control Room
                  </h2>

                  <p>
                    Payments, refunds aur provider payouts
                  </p>
                </div>

                <button
                  onClick={loadAdminData}
                >
                  ↻ Refresh
                </button>
              </div>

              <div className="statsGrid">
                <div className="statCard">
                  <span>💳</span>
                  <small>Transactions</small>
                  <strong>
                    {payments.length}
                  </strong>
                </div>

                <div className="statCard">
                  <span>✅</span>
                  <small>Successful</small>
                  <strong>
                    {
                      payments.filter(
                        (p) =>
                          p.payment_status ===
                          "paid"
                      ).length
                    }
                  </strong>
                </div>

                <div className="statCard">
                  <span>💵</span>
                  <small>Collected</small>
                  <strong>
                    {money(
                      adminStats.totalCollected
                    )}
                  </strong>
                </div>

                <div className="statCard">
                  <span>🏦</span>
                  <small>Platform Fee</small>
                  <strong>
                    {money(
                      adminStats.platformEarnings
                    )}
                  </strong>
                </div>
              </div>

              <div className="adminFilters">
                <input
                  value={adminSearch}
                  onChange={(e) =>
                    setAdminSearch(
                      e.target.value
                    )
                  }
                  placeholder="🔎 Transaction ID, customer, provider, status..."
                />
              </div>

              {filteredPayments.length === 0 ? (
                <div className="emptyState">
                  💸 Abhi payment record nahi hai.
                </div>
              ) : (
                <div className="paymentAdminGrid">
                  {filteredPayments.map(
                    (payment) => (
                      <div
                        className="paymentAdminCard"
                        key={payment.id}
                      >
                        <div className="cardTop">
                          <span className="categoryTag">
                            💳 Payment
                          </span>

                          <span className="statusPill">
                            {paymentStatusLabel(
                              payment.payment_status
                            )}
                          </span>
                        </div>

                        <h3>
                          {money(payment.amount)}
                        </h3>

                        <p>
                          👤 Customer:{" "}
                          <b>
                            {userName(
                              payment.customer_id
                            )}
                          </b>
                        </p>

                        <p>
                          🧰 Provider:{" "}
                          <b>
                            {userName(
                              payment.provider_id
                            )}
                          </b>
                        </p>

                        <p>
                          🧾 Transaction:{" "}
                          <span className="mono">
                            {payment.transaction_id ||
                              "Not provided"}
                          </span>
                        </p>

                        <div className="paymentBreakdown">
                          <span>
                            JUGAAD fee:{" "}
                            {money(
                              payment.platform_fee
                            )}
                          </span>

                          <span>
                            Provider:{" "}
                            {money(
                              payment.provider_amount
                            )}
                          </span>
                        </div>

                        <p>
                          💸 Payout:{" "}
                          {payment.payout_status}
                        </p>

                        <small>
                          {formatDate(
                            payment.created_at
                          )}
                        </small>

                        <div className="adminCardActions">
                          <button
                            onClick={() =>
                              setSelectedPayment(
                                payment
                              )
                            }
                          >
                            👁️ Details
                          </button>

                          {payment.payment_status ===
                            "pending" && (
                            <button
                              onClick={() =>
                                adminPaymentStatus(
                                  payment.id,
                                  "paid"
                                )
                              }
                            >
                              ✅ Mark Paid
                            </button>
                          )}

                          {payment.payment_status ===
                            "processing" && (
                            <button
                              onClick={() =>
                                adminPaymentStatus(
                                  payment.id,
                                  "paid"
                                )
                              }
                            >
                              ✅ Verify
                            </button>
                          )}

                          {payment.payment_status ===
                            "paid" &&
                            payment.payout_status !==
                              "paid" && (
                              <button
                                onClick={() =>
                                  adminPayout(
                                    payment.id,
                                    "paid"
                                  )
                                }
                              >
                                💸 Payout
                              </button>
                            )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>
          )}

          {/* ================= NOTIFICATIONS ================= */}

          {tab === "adminNotifications" && (
            <section className="adminPanel">
              <div className="panelHeader">
                <div>
                  <h2>
                    🔔 Notifications
                  </h2>

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
                        markNotificationRead(
                          n.id
                        )
                      }
                    >
                      <div className="notificationIcon">
                        🔔
                      </div>

                      <div>
                        <b>{n.title}</b>
                        <p>{n.message}</p>

                        <small>
                          {formatDate(
                            n.created_at
                          )}
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

        {/* ================= REQUEST MODAL ================= */}

        {selectedRequest && (
          <div
            className="modalOverlay"
            onClick={() =>
              setSelectedRequest(null)
            }
          >
            <div
              className="adminModal"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <div className="modalHeader">
                <div>
                  <h2>
                    📋 Request Details
                  </h2>
                  <small>
                    {shortId(
                      selectedRequest.id
                    )}
                  </small>
                </div>

                <button
                  onClick={() =>
                    setSelectedRequest(null)
                  }
                >
                  ✕
                </button>
              </div>

              <div className="detailList">
                <div>
                  <span>Requirement</span>
                  <b>
                    {selectedRequest.need ||
                      "—"}
                  </b>
                </div>

                <div>
                  <span>Category</span>
                  <b>
                    {selectedRequest.category ||
                      "General"}
                  </b>
                </div>

                <div>
                  <span>Customer</span>
                  <b>
                    {userName(
                      selectedRequest.user_id
                    )}
                  </b>
                </div>

                <div>
                  <span>Location</span>
                  <b>
                    {selectedRequest.location ||
                      "Not provided"}
                  </b>
                </div>

                <div>
                  <span>Provider</span>
                  <b>
                    {userName(
                      selectedRequest.provider_id
                    )}
                  </b>
                </div>

                <div>
                  <span>Status</span>
                  <b>
                    {statusLabel(
                      selectedRequest.status
                    )}
                  </b>
                </div>

                <div>
                  <span>Created</span>
                  <b>
                    {formatDate(
                      selectedRequest.created_at ||
                        selectedRequest.create_at
                    )}
                  </b>
                </div>
              </div>

              <select
                value={
                  selectedRequest.status ||
                  STATUS.pending
                }
                onChange={(e) => {
                  adminUpdateRequestStatus(
                    selectedRequest.id,
                    e.target.value
                  );

                  setSelectedRequest({
                    ...selectedRequest,
                    status: e.target.value,
                  });
                }}
              >
                <option value="pending">
                  ⏳ Pending
                </option>

                <option value="accepted">
                  🤝 Accepted
                </option>

                <option value="in_progress">
                  🚗 In Progress
                </option>

                <option value="completed">
                  ✅ Completed
                </option>

                <option value="cancelled">
                  ❌ Cancelled
                </option>
              </select>
            </div>
          </div>
        )}

        {/* ================= MATCH MODAL ================= */}

        {selectedMatch && (
          <div
            className="modalOverlay"
            onClick={() =>
              setSelectedMatch(null)
            }
          >
            <div
              className="adminModal"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <div className="modalHeader">
                <h2>
                  🤝 Match Details
                </h2>

                <button
                  onClick={() =>
                    setSelectedMatch(null)
                  }
                >
                  ✕
                </button>
              </div>

              <div className="detailList">
                <div>
                  <span>Request</span>
                  <b>
                    {shortId(
                      selectedMatch.request_id
                    )}
                  </b>
                </div>

                <div>
                  <span>Customer</span>
                  <b>
                    {userName(
                      requests.find(
                        (r) =>
                          r.id ===
                          selectedMatch.request_id
                      )?.user_id
                    )}
                  </b>
                </div>

                <div>
                  <span>Provider</span>
                  <b>
                    {userName(
                      selectedMatch.provider_id ||
                        selectedMatch.worker_id
                    )}
                  </b>
                </div>

                <div>
                  <span>Quote</span>
                  <b>
                    {selectedMatch.quoted_amount !=
                    null
                      ? money(
                          selectedMatch.quoted_amount
                        )
                      : "Not quoted"}
                  </b>
                </div>

                <div>
                  <span>Distance</span>
                  <b>
                    {selectedMatch.distance_km !=
                    null
                      ? `${selectedMatch.distance_km} km`
                      : "Not available"}
                  </b>
                </div>

                <div>
                  <span>Status</span>
                  <b>
                    {selectedMatch.status ||
                      selectedMatch.matches_status ||
                      "accepted"}
                  </b>
                </div>

                <div>
                  <span>Created</span>
                  <b>
                    {formatDate(
                      selectedMatch.created_at
                    )}
                  </b>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= PAYMENT MODAL ================= */}

        {selectedPayment && (
          <div
            className="modalOverlay"
            onClick={() =>
              setSelectedPayment(null)
            }
          >
            <div
              className="adminModal"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <div className="modalHeader">
                <div>
                  <h2>
                    💰 Payment Details
                  </h2>

                  <small>
                    {shortId(
                      selectedPayment.id
                    )}
                  </small>
                </div>

                <button
                  onClick={() =>
                    setSelectedPayment(null)
                  }
                >
                  ✕
                </button>
              </div>

              <div className="detailList">
                <div>
                  <span>Amount</span>
                  <b>
                    {money(
                      selectedPayment.amount
                    )}
                  </b>
                </div>

                <div>
                  <span>Customer</span>
                  <b>
                    {userName(
                      selectedPayment.customer_id
                    )}
                  </b>
                </div>

                <div>
                  <span>Provider</span>
                  <b>
                    {userName(
                      selectedPayment.provider_id
                    )}
                  </b>
                </div>

                <div>
                  <span>JUGAAD Fee</span>
                  <b>
                    {money(
                      selectedPayment.platform_fee
                    )}
                  </b>
                </div>

                <div>
                  <span>Provider Amount</span>
                  <b>
                    {money(
                      selectedPayment.provider_amount
                    )}
                  </b>
                </div>

                <div>
                  <span>Payment Method</span>
                  <b>
                    {selectedPayment.payment_method ||
                      "Not provided"}
                  </b>
                </div>

                <div>
                  <span>Gateway</span>
                  <b>
                    {selectedPayment.payment_gateway ||
                      "Not provided"}
                  </b>
                </div>

                <div>
                  <span>Transaction ID</span>
                  <b className="mono">
                    {selectedPayment.transaction_id ||
                      "Not provided"}
                  </b>
                </div>

                <div>
                  <span>Payment Status</span>
                  <b>
                    {paymentStatusLabel(
                      selectedPayment.payment_status
                    )}
                  </b>
                </div>

                <div>
                  <span>Refund</span>
                  <b>
                    {selectedPayment.refund_status}{" "}
                    {selectedPayment.refund_amount
                      ? `(${money(
                          selectedPayment.refund_amount
                        )})`
                      : ""}
                  </b>
                </div>

                <div>
                  <span>Provider Payout</span>
                  <b>
                    {selectedPayment.payout_status}
                  </b>
                </div>

                <div>
                  <span>Created</span>
                  <b>
                    {formatDate(
                      selectedPayment.created_at
                    )}
                  </b>
                </div>
              </div>

              <div className="modalActions">
                {selectedPayment.payment_status !==
                  "paid" &&
                  selectedPayment.payment_status !==
                    "refunded" && (
                    <button
                      className="primaryButton"
                      onClick={() =>
                        adminPaymentStatus(
                          selectedPayment.id,
                          "paid"
                        )
                      }
                    >
                      ✅ Mark Payment Paid
                    </button>
                  )}

                {selectedPayment.payment_status ===
                  "paid" && (
                  <>
                    <button
                      className="primaryButton"
                      onClick={() =>
                        adminPayout(
                          selectedPayment.id,
                          "paid"
                        )
                      }
                    >
                      💸 Mark Provider Payout Paid
                    </button>

                    <button
                      onClick={() =>
                        adminRefund(
                          selectedPayment
                        )
                      }
                    >
                      ↩️ Refund
                    </button>
                  </>
                )}

                {selectedPayment.payment_status ===
                  "pending" && (
                  <button
                    onClick={() =>
                      adminPaymentStatus(
                        selectedPayment.id,
                        "failed"
                      )
                    }
                  >
                    ❌ Mark Failed
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* =====================================================
     CUSTOMER / PROVIDER
     ===================================================== */

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
            <h3>
              Notifications 🔔
            </h3>

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
                    markNotificationRead(
                      n.id
                    )
                  }
                >
                  <b>{n.title}</b>

                  <p>{n.message}</p>

                  <small>
                    {formatDate(
                      n.created_at
                    )}
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
                  placeholder="📍 Location — jaise Jhansi"
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
                  <h2>
                    🧰 Available Kaam
                  </h2>

                  <button
                    onClick={loadRequests}
                  >
                    Refresh ↻
                  </button>
                </div>

                {providerRequests.length ===
                0 ? (
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
                <h2>
                  📋 Meri Requests
                </h2>

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

            {customerRequests.length ===
            0 ? (
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
                                      {userName(
                                        match.provider_id ||
                                          match.worker_id
                                      )}
                                    </span>
                                  </p>

                                  {match.quoted_amount !=
                                    null && (
                                    <p>
                                      💰{" "}
                                      {money(
                                        match.quoted_amount
                                      )}
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
                  setProfileName(
                    e.target.value
                  )
                }
                placeholder="Aapka naam"
              />

              <label>Phone</label>

              <input
                value={profilePhone}
                onChange={(e) =>
                  setProfilePhone(
                    e.target.value
                  )
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
                onClick={
                  switchToCustomer
                }
              >
                🧑

                <div>
                  <b>
                    Mujhe kaam chahiye
                  </b>

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
                onClick={
                  switchToProvider
                }
              >
                🧰

                <div>
                  <b>
                    Mujhe kaam karna hai
                  </b>

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
            tab === "home"
              ? "navActive"
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
            tab === "requests"
              ? "navActive"
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
              ? "navActive"
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
