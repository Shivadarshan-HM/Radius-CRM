import { useState, useEffect, useCallback, useRef } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, UserPlus, Briefcase, Receipt, FileText,
  Plus, X, Edit2, Trash2, Search, Mail, Phone, Building2,
  Calendar, Clock, CheckCircle2, AlertCircle, ChevronRight,
  Printer, Globe, LogOut, Lock, MessageCircle, Download, Settings2,
  Activity, ToggleLeft, ToggleRight, Zap, ListTodo, CheckSquare, Square, Loader2,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import {
  getToken, clearToken, login as apiLogin, register as apiRegister, fetchMe, bootstrapStatus,
  clientsApi, leadsApi, projectsApi, invoicesApi, contractsApi, fetchAnalytics, ApiError,
  automationApi, getLeadWhatsAppLink, getInvoiceWhatsAppLink, invoicePdfUrl, contractPdfUrl, downloadPdf,
  tasksApi, searchApi, submitPublicLead,
} from "./api";

/* ============================== DESIGN TOKENS ============================== */
const C = {
  bg: "#0A0A0C", sidebar: "#0C0C0F", surface: "#141417", surface2: "#1A1A1F",
  hover: "#1F1F25", border: "#26262C", borderLight: "#313138",
  text: "#F1EFEA", textDim: "#9B9894", textFaint: "#68655F",
  accent: "#CBA135", accentBright: "#E4C464", accentDim: "rgba(203,161,53,0.14)", accentBorder: "rgba(203,161,53,0.35)",
  success: "#63B48A", successDim: "rgba(99,180,138,0.14)",
  danger: "#D9707A", dangerDim: "rgba(217,112,122,0.14)",
  warning: "#D9A24B", warningDim: "rgba(217,162,75,0.14)",
  info: "#7BA6C9", infoDim: "rgba(123,166,201,0.14)",
};
const FONT_DISPLAY = "'Space Grotesk', sans-serif";
const FONT_BODY = "'Inter', sans-serif";
const FONT_MONO = "'JetBrains Mono', monospace";

const LEAD_STAGES = ["New", "Contacted", "Proposal Sent", "Won", "Lost"];
const PROJECT_TYPES = ["Web Design", "Web Development", "Web App Development"];
const PROJECT_STATUSES = ["Planning", "In Progress", "Review", "Completed", "On Hold"];
const INVOICE_STATUSES = ["Draft", "Sent", "Paid", "Overdue"];
const CONTRACT_TYPES = ["Scope of Work (SOW)", "Software Development Agreement", "NDA", "Maintenance Agreement", "Other"];
const CONTRACT_STATUSES = ["Draft", "Sent", "Signed"];
const CLIENT_STATUSES = ["Lead", "Active", "Past", "On Hold"];
const LEAD_SOURCES = ["Instagram", "LinkedIn", "Referral", "Cold Email", "Upwork", "Website", "Other"];
const AGENCY = { name: "Radius Studios", domain: "radiusstudios.in", email: "radiusstudio.co@gmail.com", tagline: "Web Design & Development Studio" };
const CHART_COLORS = [C.accent, C.info, C.success, C.warning, C.danger];

/* ============================== HELPERS ============================== */
const formatINR = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n) || 0);
const formatDate = (d) => { if (!d) return "—"; const dt = new Date(d); return isNaN(dt) ? "—" : dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); };
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthLabel = (ym) => { const [y, m] = ym.split("-"); return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-IN", { month: "short" }); };

/* ============================== UI PRIMITIVES ============================== */
function Badge({ children, tone = "default" }) {
  const map = {
    default: { bg: C.surface2, fg: C.textDim, bd: C.border },
    accent: { bg: C.accentDim, fg: C.accentBright, bd: C.accentBorder },
    success: { bg: C.successDim, fg: C.success, bd: "rgba(99,180,138,0.35)" },
    danger: { bg: C.dangerDim, fg: C.danger, bd: "rgba(217,112,122,0.35)" },
    warning: { bg: C.warningDim, fg: C.warning, bd: "rgba(217,162,75,0.35)" },
    info: { bg: C.infoDim, fg: C.info, bd: "rgba(123,166,201,0.35)" },
  };
  const s = map[tone] || map.default;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, letterSpacing: 0.2, background: s.bg, color: s.fg, border: `1px solid ${s.bd}`, whiteSpace: "nowrap" }}>{children}</span>;
}
const leadTone = (s) => s === "Won" ? "success" : s === "Lost" ? "danger" : s === "Proposal Sent" ? "accent" : s === "Contacted" ? "info" : "default";
const projectTone = (s) => s === "Completed" ? "success" : s === "In Progress" ? "accent" : s === "On Hold" ? "warning" : s === "Review" ? "info" : "default";
const invoiceTone = (s) => s === "Paid" ? "success" : s === "Overdue" ? "danger" : s === "Sent" ? "accent" : "default";
const contractTone = (s) => s === "Signed" ? "success" : s === "Sent" ? "accent" : "default";
const clientTone = (s) => s === "Active" ? "success" : s === "Lead" ? "accent" : s === "On Hold" ? "warning" : "default";

function Btn({ children, onClick, variant = "solid", icon: Icon, style, type = "button", small, disabled }) {
  const base = { display: "inline-flex", alignItems: "center", gap: 7, justifyContent: "center", fontFamily: FONT_BODY, fontWeight: 600, fontSize: small ? 12.5 : 13.5, padding: small ? "7px 12px" : "9px 16px", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", border: "1px solid transparent", transition: "all 0.15s ease", whiteSpace: "nowrap", opacity: disabled ? 0.6 : 1 };
  const variants = {
    solid: { background: C.accent, color: "#1A1408", borderColor: C.accent },
    outline: { background: "transparent", color: C.text, borderColor: C.borderLight },
    ghost: { background: "transparent", color: C.textDim, borderColor: "transparent" },
    danger: { background: "transparent", color: C.danger, borderColor: "rgba(217,112,122,0.35)" },
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={{ ...base, ...variants[variant], ...style }}
      onMouseEnter={(e) => { if (disabled) return; if (variant === "solid") e.currentTarget.style.background = C.accentBright; if (variant === "outline") e.currentTarget.style.background = C.hover; if (variant === "ghost") e.currentTarget.style.background = C.hover; if (variant === "danger") e.currentTarget.style.background = C.dangerDim; }}
      onMouseLeave={(e) => { if (variant === "solid") e.currentTarget.style.background = C.accent; if (variant === "outline") e.currentTarget.style.background = "transparent"; if (variant === "ghost") e.currentTarget.style.background = "transparent"; if (variant === "danger") e.currentTarget.style.background = "transparent"; }}>
      {Icon && <Icon size={small ? 14 : 15} strokeWidth={2.2} />}
      {children}
    </button>
  );
}
function IconBtn({ icon: Icon, onClick, tone = "default", title }) {
  const color = tone === "danger" ? C.danger : C.textDim;
  return (
    <button title={title} onClick={onClick} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 7, border: `1px solid ${C.border}`, background: "transparent", color, cursor: "pointer", transition: "all 0.15s ease" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = tone === "danger" ? C.dangerDim : C.hover; e.currentTarget.style.borderColor = tone === "danger" ? "rgba(217,112,122,0.4)" : C.borderLight; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = C.border; }}>
      <Icon size={14.5} strokeWidth={2.2} />
    </button>
  );
}
const fieldStyle = () => ({ width: "100%", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 11px", color: C.text, fontSize: 13.5, fontFamily: FONT_BODY, outline: "none" });
function Field({ label, children }) { return <div style={{ display: "flex", flexDirection: "column", gap: 6 }}><label style={{ fontSize: 12, fontWeight: 600, color: C.textDim, letterSpacing: 0.2 }}>{label}</label>{children}</div>; }
function Input(props) { return <input {...props} style={{ ...fieldStyle(), ...(props.style || {}) }} onFocus={(e) => e.currentTarget.style.borderColor = C.accentBorder} onBlur={(e) => e.currentTarget.style.borderColor = C.border} />; }
function TextArea(props) { return <textarea {...props} rows={props.rows || 3} style={{ ...fieldStyle(), resize: "vertical", ...(props.style || {}) }} onFocus={(e) => e.currentTarget.style.borderColor = C.accentBorder} onBlur={(e) => e.currentTarget.style.borderColor = C.border} />; }
function Select(props) { return <select {...props} style={{ ...fieldStyle(), ...(props.style || {}) }}>{props.children}</select>; }
function Card({ children, style, ...rest }) { return <div {...rest} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, ...style }}>{children}</div>; }
function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "56px 24px", textAlign: "center", gap: 6 }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, background: C.accentDim, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8, border: `1px solid ${C.accentBorder}` }}><Icon size={20} color={C.accent} strokeWidth={2} /></div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 600, color: C.text }}>{title}</div>
      <div style={{ fontSize: 13, color: C.textFaint, maxWidth: 320 }}>{subtitle}</div>
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>
  );
}
function Modal({ title, onClose, children, width = 560 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(6,6,8,0.72)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 100, padding: "5vh 20px", overflowY: "auto" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 14, width: "100%", maxWidth: width, boxShadow: "0 24px 60px rgba(0,0,0,0.55)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16.5, fontWeight: 600, color: C.text }}>{title}</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.textDim, cursor: "pointer", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7 }} onMouseEnter={(e) => e.currentTarget.style.background = C.hover} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}><X size={17} /></button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}
function ConfirmDialog({ text, onCancel, onConfirm }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(6,6,8,0.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 14, width: "100%", maxWidth: 380, padding: 22, boxShadow: "0 24px 60px rgba(0,0,0,0.55)" }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: C.dangerDim, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><AlertCircle size={18} color={C.danger} /></div>
          <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.5, paddingTop: 6 }}>{text}</div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn variant="outline" onClick={onCancel} small>Cancel</Btn>
          <Btn variant="danger" onClick={onConfirm} small style={{ borderColor: "rgba(217,112,122,0.5)" }}>Delete</Btn>
        </div>
      </div>
    </div>
  );
}
function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div style={{ position: "fixed", top: 16, right: 16, zIndex: 300, background: C.surface, border: `1px solid rgba(217,112,122,0.4)`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, maxWidth: 380, boxShadow: "0 12px 30px rgba(0,0,0,0.4)" }}>
      <AlertCircle size={16} color={C.danger} />
      <div style={{ fontSize: 12.5, color: C.text, flex: 1 }}>{message}</div>
      <button onClick={onDismiss} style={{ background: "none", border: "none", color: C.textFaint, cursor: "pointer" }}><X size={14} /></button>
    </div>
  );
}

/* ============================== LOGIN ============================== */
function LoginScreen({ onLoggedIn, needsBootstrap, setNeedsBootstrap }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    if (needsBootstrap && password !== confirm) { setErr("Passwords don't match."); return; }
    if (needsBootstrap && password.length < 8) { setErr("Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      if (needsBootstrap) {
        await apiRegister(email, password);
      }
      await apiLogin(email, password);
      onLoggedIn();
    } catch (e2) {
      if (e2 instanceof ApiError && e2.status === 403) {
        setNeedsBootstrap(false);
        setErr("An admin account already exists — log in instead.");
      } else {
        setErr(e2.message || "Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          <img src="/logo.png" alt="Radius Logo" style={{ height: 46, objectFit: "contain", marginBottom: 14 }} />
          <div style={{ fontSize: 11.5, color: C.textFaint, letterSpacing: 0.6, textTransform: "uppercase", marginTop: 3 }}>Studio CRM</div>
        </div>

        <Card style={{ padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <Lock size={15} color={C.accent} />
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 600, color: C.text }}>
              {needsBootstrap ? "Create your admin account" : "Sign in"}
            </div>
          </div>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Email"><Input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@radiusstudios.in" /></Field>
            <Field label="Password"><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={needsBootstrap ? "At least 8 characters" : "••••••••"} /></Field>
            {needsBootstrap && <Field label="Confirm password"><Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>}
            {err && <div style={{ fontSize: 12.5, color: C.danger, background: C.dangerDim, padding: "8px 10px", borderRadius: 7 }}>{err}</div>}
            <Btn type="submit" variant="solid" disabled={loading} style={{ marginTop: 4, justifyContent: "center" }}>
              {loading ? "Please wait..." : needsBootstrap ? "Create account & sign in" : "Sign in"}
            </Btn>
          </form>
        </Card>
        {needsBootstrap && (
          <div style={{ fontSize: 11.5, color: C.textFaint, textAlign: "center", marginTop: 14 }}>
            This is a one-time setup — the CRM is single-operator, so registration closes right after this.
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================== SIDEBAR / TOPBAR ============================== */
function Sidebar({ page, setPage, counts, onLogout, onOpenSearch }) {
  const items = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "leads", label: "Leads", icon: UserPlus, count: counts.leads },
    { key: "clients", label: "Clients", icon: Users, count: counts.clients },
    { key: "projects", label: "Projects", icon: Briefcase, count: counts.projects },
    { key: "invoices", label: "Invoices", icon: Receipt, count: counts.invoices },
    { key: "contracts", label: "Contracts", icon: FileText, count: counts.contracts },
    { key: "tasks", label: "Tasks", icon: ListTodo, count: counts.tasks },
    { key: "automation", label: "Automation", icon: Zap },
  ];
  return (
    <div style={{ width: 232, flexShrink: 0, background: C.sidebar, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0 }}>
      <div style={{ padding: "22px 20px 18px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" alt="Radius Logo" style={{ height: 28, objectFit: "contain" }} />
          <div>
            <div style={{ fontSize: 10.5, color: C.textFaint, letterSpacing: 0.6, textTransform: "uppercase", marginTop: 1 }}>Studio CRM</div>
          </div>
        </div>
      </div>
      {/* Search button */}
      <div style={{ padding: "10px 12px 4px" }}>
        <button
          onClick={onOpenSearch}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.textFaint, fontSize: 12.5, fontFamily: FONT_BODY, cursor: "pointer", transition: "all 0.15s ease" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.borderLight; e.currentTarget.style.background = C.hover; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface; }}
        >
          <Search size={13} strokeWidth={2} />
          <span style={{ flex: 1, textAlign: "left" }}>Search...</span>
          <span style={{ fontSize: 10.5, color: C.textFaint, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 4, padding: "1px 5px", fontFamily: FONT_MONO }}>⌘K</span>
        </button>
      </div>
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 2, flex: 1, overflowY: "auto" }}>
        {items.map((it) => {
          const active = page === it.key;
          return (
            <button key={it.key} onClick={() => setPage(it.key)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left", background: active ? C.accentDim : "transparent", color: active ? C.accentBright : C.textDim, fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: active ? 600 : 500, borderLeft: active ? `2px solid ${C.accent}` : "2px solid transparent", transition: "all 0.15s ease" }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = C.hover; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
              <it.icon size={16} strokeWidth={2} />
              <span style={{ flex: 1 }}>{it.label}</span>
              {typeof it.count === "number" && it.count > 0 && <span style={{ fontSize: 11, fontFamily: FONT_MONO, color: active ? C.accentBright : C.textFaint, background: active ? "rgba(203,161,53,0.18)" : C.surface2, padding: "1px 6px", borderRadius: 999 }}>{it.count}</span>}
            </button>
          );
        })}
      </div>
      <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.border}` }}>
        <button onClick={onLogout} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent", border: "none", color: C.textDim, fontSize: 12.5, cursor: "pointer", padding: "6px 0", fontFamily: FONT_BODY }}
          onMouseEnter={(e) => e.currentTarget.style.color = C.danger} onMouseLeave={(e) => e.currentTarget.style.color = C.textDim}>
          <LogOut size={13} /> Log out
        </button>
        <div style={{ fontSize: 11, color: C.textFaint, lineHeight: 1.6, marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Globe size={11} /> {AGENCY.domain}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}><Mail size={11} /> {AGENCY.email}</div>
        </div>
      </div>
    </div>
  );
}

function Topbar({ title, subtitle, action }) {

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 32px 20px", borderBottom: `1px solid ${C.border}` }}>
      <div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 600, color: C.text, letterSpacing: -0.3 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: C.textFaint, marginTop: 3 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

/* ============================== DASHBOARD ============================== */
function StatCard({ label, value, icon: Icon, trend }) {
  return (
    <Card style={{ padding: 18, flex: 1, minWidth: 180 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12, color: C.textFaint, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" }}>{label}</div>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: C.accentDim, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={14} color={C.accent} /></div>
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 600, color: C.text, marginTop: 10 }}>{value}</div>
      {trend && <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 4 }}>{trend}</div>}
    </Card>
  );
}
function ChartCard({ title, children }) {
  return (
    <Card style={{ padding: 20, flex: "1 1 320px" }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14.5, fontWeight: 600, color: C.text, marginBottom: 14 }}>{title}</div>
      <div style={{ height: 200 }}>{children}</div>
    </Card>
  );
}
function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: C.surface2, border: `1px solid ${C.borderLight}`, borderRadius: 8, padding: "8px 11px", fontSize: 12 }}>
      <div style={{ color: C.textFaint, marginBottom: 3 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: C.text, fontFamily: FONT_MONO }}>{formatter ? formatter(p.value) : p.value}</div>)}
    </div>
  );
}

/* ============================== TASK DASHBOARD CARD ============================== */
function TaskDashboardCard({ tasks, onToggleTask, setPage }) {
  const today = todayISO();
  const urgent = tasks
    .filter((t) => t.status === "Pending" && (t.due_date <= today))
    .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
    .slice(0, 5);
  const isOverdue = (t) => t.due_date && t.due_date < today;

  return (
    <Card style={{ padding: 20, flex: "1 1 300px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: C.accentDim, display: "flex", alignItems: "center", justifyContent: "center" }}><ListTodo size={13} color={C.accent} /></div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 600, color: C.text }}>Today & Overdue</div>
        </div>
        <button onClick={() => setPage("tasks")} style={{ background: "none", border: "none", color: C.accent, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>View all <ChevronRight size={13} /></button>
      </div>
      {urgent.length === 0 ? (
        <div style={{ fontSize: 12.5, color: C.textFaint }}>Nothing due today. 🎉</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {urgent.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
              <button onClick={() => onToggleTask(t)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, padding: 0, display: "flex", flexShrink: 0 }}>
                <Square size={15} strokeWidth={1.8} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                {t.due_date && <div style={{ fontSize: 11, color: isOverdue(t) ? C.danger : C.textFaint, marginTop: 1 }}>{isOverdue(t) ? "Overdue · " : "Due "}{formatDate(t.due_date)}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Dashboard({ leads, clients, projects, invoices, analytics, tasks, onToggleTask, setPage }) {
  const activeLeads = leads.filter((l) => l.stage !== "Won" && l.stage !== "Lost").length;
  const activeProjects = projects.filter((p) => p.status === "In Progress" || p.status === "Review").length;
  const outstanding = invoices.filter((i) => i.status === "Sent" || i.status === "Overdue").reduce((s, i) => s + Number(i.amount || 0), 0);
  const collected = invoices.filter((i) => i.status === "Paid").reduce((s, i) => s + Number(i.amount || 0), 0);
  const clientName = (id) => clients.find((c) => c.id === id)?.company || "—";
  const recentProjects = [...projects].sort((a, b) => (b.start_date || "").localeCompare(a.start_date || "")).slice(0, 4);
  const pendingInvoices = invoices.filter((i) => i.status !== "Paid").sort((a, b) => (a.due_date || "").localeCompare(b.due_date || "")).slice(0, 4);

  const revenueData = (analytics?.revenue_trend || []).map((r) => ({ month: monthLabel(r.month), amount: r.amount }));
  const funnelData = analytics?.lead_funnel || [];
  const statusData = (analytics?.project_status || []).filter((s) => s.count > 0);

  return (
    <div style={{ padding: "24px 32px 40px", display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <StatCard label="Active Leads" value={activeLeads} icon={UserPlus} trend={`${leads.length} total in pipeline`} />
        <StatCard label="Active Projects" value={activeProjects} icon={Briefcase} trend={`${projects.length} total projects`} />
        <StatCard label="Outstanding" value={formatINR(outstanding)} icon={Clock} trend="Sent / overdue invoices" />
        <StatCard label="Collected" value={formatINR(collected)} icon={CheckCircle2} trend="Paid to date" />
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        <ChartCard title="Revenue Trend (6 months)">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={C.border} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: C.textFaint, fontSize: 11.5 }} axisLine={{ stroke: C.border }} tickLine={false} />
              <YAxis tick={{ fill: C.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} width={54} tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : v} />
              <Tooltip content={<ChartTooltip formatter={formatINR} />} cursor={{ stroke: C.borderLight }} />
              <Line type="monotone" dataKey="amount" stroke={C.accent} strokeWidth={2.5} dot={{ fill: C.accent, r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Lead Conversion Funnel">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnelData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={C.border} vertical={false} />
              <XAxis dataKey="stage" tick={{ fill: C.textFaint, fontSize: 10.5 }} axisLine={{ stroke: C.border }} tickLine={false} interval={0} angle={-12} textAnchor="end" height={40} />
              <YAxis tick={{ fill: C.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {funnelData.map((entry, i) => (
                  <Cell key={i} fill={entry.stage === "Won" ? C.success : entry.stage === "Lost" ? C.danger : C.accent} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Project Status Breakdown">
          {statusData.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 12.5, color: C.textFaint }}>No projects yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3}>
                  {statusData.map((entry, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, justifyContent: "center" }}>
            {statusData.map((s, i) => (
              <div key={s.status} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.textDim }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: CHART_COLORS[i % CHART_COLORS.length] }} />{s.status}
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
        <TaskDashboardCard tasks={tasks} onToggleTask={onToggleTask} setPage={setPage} />
        <Card style={{ padding: 20, flex: "1 1 340px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 600, color: C.text }}>Recent Projects</div>
            <button onClick={() => setPage("projects")} style={{ background: "none", border: "none", color: C.accent, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>View all <ChevronRight size={13} /></button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recentProjects.length === 0 && <div style={{ fontSize: 12.5, color: C.textFaint }}>No projects yet.</div>}
            {recentProjects.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
                <div><div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{p.name}</div><div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 2 }}>{clientName(p.client_id)}</div></div>
                <Badge tone={projectTone(p.status)}>{p.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
        <Card style={{ padding: 20, flex: "1 1 340px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 600, color: C.text }}>Pending Invoices</div>
            <button onClick={() => setPage("invoices")} style={{ background: "none", border: "none", color: C.accent, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>View all <ChevronRight size={13} /></button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pendingInvoices.length === 0 && <div style={{ fontSize: 12.5, color: C.textFaint }}>Nothing pending. Nice.</div>}
            {pendingInvoices.map((i) => (
              <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
                <div><div style={{ fontSize: 13, color: C.text, fontWeight: 500, fontFamily: FONT_MONO }}>{i.number}</div><div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 2 }}>{clientName(i.client_id)} · due {formatDate(i.due_date)}</div></div>
                <div style={{ textAlign: "right" }}><div style={{ fontSize: 13, color: C.text, fontFamily: FONT_MONO }}>{formatINR(i.amount)}</div><Badge tone={invoiceTone(i.status)}>{i.status}</Badge></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}


/* ============================== LEADS ============================== */
function LeadForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState(initial || { company: "", contact_name: "", email: "", phone: "", stage: "New", source: "Instagram", value: "", notes: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(f); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Business / Contact name *"><Input required value={f.company} onChange={(e) => set("company", e.target.value)} placeholder="e.g. Ketone Gym & Fitness" /></Field>
        <Field label="Contact person"><Input value={f.contact_name} onChange={(e) => set("contact_name", e.target.value)} /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Stage"><Select value={f.stage} onChange={(e) => set("stage", e.target.value)}>{LEAD_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field>
        <Field label="Source"><Select value={f.source} onChange={(e) => set("source", e.target.value)}>{LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field>
        <Field label="Est. deal value (₹)"><Input type="number" value={f.value} onChange={(e) => set("value", e.target.value)} placeholder="20000" /></Field>
      </div>
      <Field label="Notes"><TextArea value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}><Btn variant="outline" onClick={onCancel}>Cancel</Btn><Btn type="submit" variant="solid">Save Lead</Btn></div>
    </form>
  );
}
function LeadCard({ lead, onEdit, onDelete, onStage, onWhatsApp }) {
  return (
    <Card style={{ padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{lead.company}</div>
        <div style={{ display: "flex", gap: 4 }}>
          {lead.phone && <IconBtn icon={MessageCircle} onClick={() => onWhatsApp(lead)} title="Open in WhatsApp" />}
          <IconBtn icon={Edit2} onClick={() => onEdit(lead)} title="Edit" />
          <IconBtn icon={Trash2} tone="danger" onClick={() => onDelete(lead)} title="Delete" />
        </div>
      </div>
      {lead.contact_name && <div style={{ fontSize: 12, color: C.textDim, marginTop: 3 }}>{lead.contact_name}</div>}
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}><Badge>{lead.source}</Badge>{lead.value ? <Badge tone="accent">{formatINR(lead.value)}</Badge> : null}</div>
      <div style={{ marginTop: 10 }}><Select value={lead.stage} onChange={(e) => onStage(lead, e.target.value)} style={{ fontSize: 12, padding: "6px 8px" }}>{LEAD_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
    </Card>
  );
}
function LeadsPage({ leads, onAdd, onUpdate, onDelete, onError }) {
  const [modal, setModal] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  async function handleWhatsApp(lead) {
    try {
      const data = await getLeadWhatsAppLink(lead.id);
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      onError(e.message || "Could not build WhatsApp link — make sure the lead has a phone number.");
    }
  }

  return (
    <div style={{ padding: "0 32px 40px" }}>
      <Topbar title="Leads" subtitle="Pipeline for prospective gym, business and web clients" action={<Btn icon={Plus} onClick={() => setModal({ mode: "add" })}>Add Lead</Btn>} />
      {leads.length === 0 ? (
        <div style={{ marginTop: 20 }}><Card><EmptyState icon={UserPlus} title="No leads yet" subtitle="Start tracking prospects you're reaching out to on Instagram, LinkedIn, cold email and more." action={<Btn icon={Plus} onClick={() => setModal({ mode: "add" })}>Add your first lead</Btn>} /></Card></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginTop: 22, alignItems: "start" }}>
          {LEAD_STAGES.map((stage) => (
            <div key={stage}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, padding: "0 2px" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.textDim, letterSpacing: 0.3, textTransform: "uppercase" }}>{stage}</span>
                <span style={{ fontSize: 11, color: C.textFaint, fontFamily: FONT_MONO }}>{leads.filter((l) => l.stage === stage).length}</span>
              </div>
              {leads.filter((l) => l.stage === stage).map((lead) => (
                <LeadCard key={lead.id} lead={lead} onEdit={(l) => setModal({ mode: "edit", data: l })} onDelete={(l) => setConfirmDel(l)} onStage={(l, stage) => onUpdate(l.id, { stage })} onWhatsApp={handleWhatsApp} />
              ))}
            </div>
          ))}
        </div>
      )}
      {modal && <Modal title={modal.mode === "add" ? "Add Lead" : "Edit Lead"} onClose={() => setModal(null)}><LeadForm initial={modal.data} onCancel={() => setModal(null)} onSave={(f) => { modal.mode === "add" ? onAdd(f) : onUpdate(modal.data.id, f); setModal(null); }} /></Modal>}
      {confirmDel && <ConfirmDialog text={`Delete lead "${confirmDel.company}"? This can't be undone.`} onCancel={() => setConfirmDel(null)} onConfirm={() => { onDelete(confirmDel.id); setConfirmDel(null); }} />}
    </div>
  );
}

/* ============================== CLIENTS ============================== */
function ClientForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState(initial || { company: "", contact_name: "", email: "", phone: "", industry: "", status: "Active", source: "Referral", notes: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(f); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Company name *"><Input required value={f.company} onChange={(e) => set("company", e.target.value)} /></Field>
        <Field label="Contact person"><Input value={f.contact_name} onChange={(e) => set("contact_name", e.target.value)} /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Industry"><Input value={f.industry} onChange={(e) => set("industry", e.target.value)} placeholder="e.g. Fitness, Retail, SaaS" /></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{CLIENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field>
      </div>
      <Field label="Notes"><TextArea value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}><Btn variant="outline" onClick={onCancel}>Cancel</Btn><Btn type="submit" variant="solid">Save Client</Btn></div>
    </form>
  );
}
function ClientsPage({ clients, projects, onAdd, onUpdate, onDelete, openDetailId }) {
  const [modal, setModal] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [detail, setDetail] = useState(null);
  const [q, setQ] = useState("");
  // Auto-open detail modal when navigated to from search
  useEffect(() => {
    if (openDetailId) {
      const c = clients.find((x) => x.id === openDetailId);
      if (c) setDetail(c);
    }
  }, [openDetailId, clients]);

  const filtered = clients.filter((c) => c.company.toLowerCase().includes(q.toLowerCase()) || (c.industry || "").toLowerCase().includes(q.toLowerCase()));
  const projectCount = (clientId) => projects.filter((p) => p.client_id === clientId).length;
  return (
    <div style={{ padding: "0 32px 40px" }}>
      <Topbar title="Clients" subtitle="Everyone you've built for, or are building for" action={<Btn icon={Plus} onClick={() => setModal({ mode: "add" })}>Add Client</Btn>} />
      <div style={{ marginTop: 18, marginBottom: 16, position: "relative", maxWidth: 320 }}>
        <Search size={14} color={C.textFaint} style={{ position: "absolute", left: 11, top: 11 }} />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients..." style={{ paddingLeft: 32 }} />
      </div>
      {filtered.length === 0 ? (
        <Card><EmptyState icon={Users} title="No clients found" subtitle="Add a client to start tracking projects, invoices and contracts for them." action={<Btn icon={Plus} onClick={() => setModal({ mode: "add" })}>Add Client</Btn>} /></Card>
      ) : (
        <Card style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>{["Company", "Industry", "Status", "Projects", ""].map((h) => <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 11.5, color: C.textFaint, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} onClick={() => setDetail(c)} style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer" }} onMouseEnter={(e) => e.currentTarget.style.background = C.hover} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "13px 16px" }}><div style={{ fontSize: 13.5, color: C.text, fontWeight: 500 }}>{c.company}</div>{c.contact_name && <div style={{ fontSize: 12, color: C.textFaint, marginTop: 2 }}>{c.contact_name}</div>}</td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: C.textDim }}>{c.industry || "—"}</td>
                  <td style={{ padding: "13px 16px" }}><Badge tone={clientTone(c.status)}>{c.status}</Badge></td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: C.textDim, fontFamily: FONT_MONO }}>{projectCount(c.id)}</td>
                  <td style={{ padding: "13px 16px" }} onClick={(e) => e.stopPropagation()}><div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}><IconBtn icon={Edit2} onClick={() => setModal({ mode: "edit", data: c })} title="Edit" /><IconBtn icon={Trash2} tone="danger" onClick={() => setConfirmDel(c)} title="Delete" /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {modal && <Modal title={modal.mode === "add" ? "Add Client" : "Edit Client"} onClose={() => setModal(null)}><ClientForm initial={modal.data} onCancel={() => setModal(null)} onSave={(f) => { modal.mode === "add" ? onAdd(f) : onUpdate(modal.data.id, f); setModal(null); }} /></Modal>}
      {confirmDel && <ConfirmDialog text={`Delete client "${confirmDel.company}"? Linked projects, invoices and contracts will be deleted too.`} onCancel={() => setConfirmDel(null)} onConfirm={() => { onDelete(confirmDel.id); setConfirmDel(null); }} />}
      {detail && (
        <Modal title={detail.company} onClose={() => setDetail(null)} width={480}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Badge tone={clientTone(detail.status)}>{detail.status}</Badge>{detail.industry && <Badge>{detail.industry}</Badge>}{detail.source && <Badge>{detail.source}</Badge>}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: C.textDim }}>
              {detail.contact_name && <div style={{ display: "flex", gap: 8, alignItems: "center" }}><Users size={13} /> {detail.contact_name}</div>}
              {detail.email && <div style={{ display: "flex", gap: 8, alignItems: "center" }}><Mail size={13} /> {detail.email}</div>}
              {detail.phone && <div style={{ display: "flex", gap: 8, alignItems: "center" }}><Phone size={13} /> {detail.phone}</div>}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}><Calendar size={13} /> Client since {formatDate(detail.created_at)}</div>
            </div>
            {detail.notes && <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6, background: C.surface2, padding: 12, borderRadius: 8, border: `1px solid ${C.border}` }}>{detail.notes}</div>}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textFaint, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 8 }}>Projects</div>
              {projects.filter((p) => p.client_id === detail.id).length === 0 && <div style={{ fontSize: 12.5, color: C.textFaint }}>No projects linked yet.</div>}
              {projects.filter((p) => p.client_id === detail.id).map((p) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}><div style={{ fontSize: 13, color: C.text }}>{p.name}</div><Badge tone={projectTone(p.status)}>{p.status}</Badge></div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ============================== PROJECTS ============================== */
function ProjectForm({ initial, clients, onSave, onCancel }) {
  const [f, setF] = useState(initial || { name: "", client_id: clients[0]?.id || "", type: "Web Development", stack: "", budget: "", status: "Planning", start_date: todayISO(), due_date: "", notes: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(f); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Field label="Project name *"><Input required value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Business Website Redesign" /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Client"><Select value={f.client_id} onChange={(e) => set("client_id", e.target.value)}><option value="">— None —</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}</Select></Field>
        <Field label="Type"><Select value={f.type} onChange={(e) => set("type", e.target.value)}>{PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
        <Field label="Budget (₹)"><Input type="number" value={f.budget} onChange={(e) => set("budget", e.target.value)} /></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field>
        <Field label="Start date"><Input type="date" value={f.start_date || ""} onChange={(e) => set("start_date", e.target.value)} /></Field>
        <Field label="Due date"><Input type="date" value={f.due_date || ""} onChange={(e) => set("due_date", e.target.value)} /></Field>
      </div>
      <Field label="Tech stack"><Input value={f.stack} onChange={(e) => set("stack", e.target.value)} placeholder="e.g. Next.js, Tailwind, FastAPI" /></Field>
      <Field label="Notes"><TextArea value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}><Btn variant="outline" onClick={onCancel}>Cancel</Btn><Btn type="submit" variant="solid">Save Project</Btn></div>
    </form>
  );
}
function ProjectsPage({ projects, clients, invoices, onAdd, onUpdate, onDelete, openDetailId }) {
  const [modal, setModal] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [detail, setDetail] = useState(null);
  const [filter, setFilter] = useState("All");
  const clientName = (id) => clients.find((c) => c.id === id)?.company || "—";
  const filtered = filter === "All" ? projects : projects.filter((p) => p.status === filter);
  // Auto-open detail modal when navigated to from search
  useEffect(() => {
    if (openDetailId) {
      const p = projects.find((x) => x.id === openDetailId);
      if (p) setDetail(p);
    }
  }, [openDetailId, projects]);

  return (
    <div style={{ padding: "0 32px 40px" }}>
      <Topbar title="Projects" subtitle="Design, development and web app builds in flight" action={<Btn icon={Plus} onClick={() => setModal({ mode: "add" })}>Add Project</Btn>} />
      <div style={{ display: "flex", gap: 6, margin: "18px 0 18px", flexWrap: "wrap" }}>
        {["All", ...PROJECT_STATUSES].map((s) => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding: "6px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: `1px solid ${filter === s ? C.accentBorder : C.border}`, background: filter === s ? C.accentDim : "transparent", color: filter === s ? C.accentBright : C.textDim }}>{s}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <Card><EmptyState icon={Briefcase} title="No projects here" subtitle="Add a project to start tracking scope, budget and status." action={<Btn icon={Plus} onClick={() => setModal({ mode: "add" })}>Add Project</Btn>} /></Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {filtered.map((p) => (
            <Card key={p.id} style={{ padding: 18, cursor: "pointer" }} onClick={() => setDetail(p)} onMouseEnter={(e) => e.currentTarget.style.borderColor = C.borderLight} onMouseLeave={(e) => e.currentTarget.style.borderColor = C.border}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Badge tone={projectTone(p.status)}>{p.status}</Badge>
                <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}><IconBtn icon={Edit2} onClick={() => setModal({ mode: "edit", data: p })} title="Edit" /><IconBtn icon={Trash2} tone="danger" onClick={() => setConfirmDel(p)} title="Delete" /></div>
              </div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15.5, fontWeight: 600, color: C.text, marginTop: 12 }}>{p.name}</div>
              <div style={{ fontSize: 12.5, color: C.textDim, marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}><Building2 size={12} /> {clientName(p.client_id)}</div>
              <div style={{ fontSize: 12, color: C.textFaint, marginTop: 8 }}>{p.type}{p.stack ? ` · ${p.stack}` : ""}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 13.5, color: C.accentBright }}>{p.budget ? formatINR(p.budget) : "—"}</span>
                <span style={{ fontSize: 11.5, color: C.textFaint }}>{formatDate(p.start_date)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
      {modal && <Modal title={modal.mode === "add" ? "Add Project" : "Edit Project"} onClose={() => setModal(null)}><ProjectForm initial={modal.data} clients={clients} onCancel={() => setModal(null)} onSave={(f) => { modal.mode === "add" ? onAdd(f) : onUpdate(modal.data.id, f); setModal(null); }} /></Modal>}
      {confirmDel && <ConfirmDialog text={`Delete project "${confirmDel.name}"?`} onCancel={() => setConfirmDel(null)} onConfirm={() => { onDelete(confirmDel.id); setConfirmDel(null); }} />}
      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)} width={500}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Badge tone={projectTone(detail.status)}>{detail.status}</Badge><Badge>{detail.type}</Badge></div>
            <div style={{ fontSize: 13, color: C.textDim, display: "flex", flexDirection: "column", gap: 6 }}>
              <div>Client: <span style={{ color: C.text }}>{clientName(detail.client_id)}</span></div>
              {detail.stack && <div>Stack: <span style={{ color: C.text }}>{detail.stack}</span></div>}
              <div>Budget: <span style={{ color: C.accentBright, fontFamily: FONT_MONO }}>{detail.budget ? formatINR(detail.budget) : "—"}</span></div>
              <div>Timeline: <span style={{ color: C.text }}>{formatDate(detail.start_date)} → {formatDate(detail.due_date)}</span></div>
            </div>
            {detail.notes && <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6, background: C.surface2, padding: 12, borderRadius: 8, border: `1px solid ${C.border}` }}>{detail.notes}</div>}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textFaint, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 8 }}>Invoices</div>
              {invoices.filter((i) => i.project_id === detail.id).length === 0 && <div style={{ fontSize: 12.5, color: C.textFaint }}>None yet.</div>}
              {invoices.filter((i) => i.project_id === detail.id).map((i) => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 13, color: C.text, fontFamily: FONT_MONO }}>{i.number}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ fontSize: 13, color: C.textDim, fontFamily: FONT_MONO }}>{formatINR(i.amount)}</span><Badge tone={invoiceTone(i.status)}>{i.status}</Badge></div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ============================== INVOICES ============================== */
function InvoiceForm({ initial, clients, projects, nextNumber, onSave, onCancel }) {
  const [f, setF] = useState(initial || { number: nextNumber, client_id: clients[0]?.id || "", project_id: "", description: "", amount: "", status: "Draft", issue_date: todayISO(), due_date: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const clientProjects = projects.filter((p) => p.client_id === f.client_id);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(f); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Invoice number *"><Input required value={f.number} onChange={(e) => set("number", e.target.value)} style={{ fontFamily: FONT_MONO }} /></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{INVOICE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field>
        <Field label="Client"><Select value={f.client_id} onChange={(e) => set("client_id", e.target.value)}><option value="">— None —</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}</Select></Field>
        <Field label="Project"><Select value={f.project_id} onChange={(e) => set("project_id", e.target.value)}><option value="">— None —</option>{clientProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="Amount (₹) *"><Input required type="number" value={f.amount} onChange={(e) => set("amount", e.target.value)} /></Field>
        <Field label="Issue date"><Input type="date" value={f.issue_date || ""} onChange={(e) => set("issue_date", e.target.value)} /></Field>
        <Field label="Due date"><Input type="date" value={f.due_date || ""} onChange={(e) => set("due_date", e.target.value)} /></Field>
      </div>
      <Field label="Description"><TextArea value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="e.g. Advance payment (50%) — website redesign" /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}><Btn variant="outline" onClick={onCancel}>Cancel</Btn><Btn type="submit" variant="solid">Save Invoice</Btn></div>
    </form>
  );
}
function InvoicesPage({ invoices, clients, projects, onAdd, onUpdate, onDelete, onError }) {
  const [modal, setModal] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const clientName = (id) => clients.find((c) => c.id === id)?.company || "—";
  const nextNumber = `RS-${String(invoices.length + 1).padStart(3, "0")}`;
  const totals = { paid: invoices.filter((i) => i.status === "Paid").reduce((s, i) => s + Number(i.amount || 0), 0), outstanding: invoices.filter((i) => i.status !== "Paid").reduce((s, i) => s + Number(i.amount || 0), 0) };
  return (
    <div style={{ padding: "0 32px 40px" }}>
      <Topbar title="Invoices" subtitle="Advance and delivery payments across all clients" action={<Btn icon={Plus} onClick={() => setModal({ mode: "add" })}>Add Invoice</Btn>} />
      <div style={{ display: "flex", gap: 14, margin: "18px 0 20px" }}>
        <Card style={{ padding: "14px 18px" }}><div style={{ fontSize: 11.5, color: C.textFaint, fontWeight: 600, textTransform: "uppercase" }}>Collected</div><div style={{ fontFamily: FONT_MONO, fontSize: 18, color: C.success, marginTop: 4 }}>{formatINR(totals.paid)}</div></Card>
        <Card style={{ padding: "14px 18px" }}><div style={{ fontSize: 11.5, color: C.textFaint, fontWeight: 600, textTransform: "uppercase" }}>Outstanding</div><div style={{ fontFamily: FONT_MONO, fontSize: 18, color: C.warning, marginTop: 4 }}>{formatINR(totals.outstanding)}</div></Card>
      </div>
      {invoices.length === 0 ? (
        <Card><EmptyState icon={Receipt} title="No invoices yet" subtitle="Create your first invoice once a client agrees to the project scope." action={<Btn icon={Plus} onClick={() => setModal({ mode: "add" })}>Add Invoice</Btn>} /></Card>
      ) : (
        <Card style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>{["Invoice", "Client", "Amount", "Status", "Due", ""].map((h) => <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 11.5, color: C.textFaint, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{h}</th>)}</tr></thead>
            <tbody>
              {[...invoices].sort((a, b) => (b.issue_date || "").localeCompare(a.issue_date || "")).map((i) => (
                <tr key={i.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "13px 16px", fontFamily: FONT_MONO, fontSize: 13, color: C.text }}>{i.number}</td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: C.textDim }}>{clientName(i.client_id)}</td>
                  <td style={{ padding: "13px 16px", fontFamily: FONT_MONO, fontSize: 13, color: C.accentBright }}>{formatINR(i.amount)}</td>
                  <td style={{ padding: "13px 16px" }}><Select value={i.status} onChange={(e) => onUpdate(i.id, { status: e.target.value })} style={{ fontSize: 12, padding: "5px 8px", width: "auto" }}>{INVOICE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></td>
                  <td style={{ padding: "13px 16px", fontSize: 12.5, color: C.textFaint }}>{formatDate(i.due_date)}</td>
                  <td style={{ padding: "13px 16px" }}><div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <IconBtn icon={MessageCircle} onClick={async () => { try { const d = await getInvoiceWhatsAppLink(i.id); window.open(d.url, "_blank", "noopener,noreferrer"); } catch (e) { onError(e.message); } }} title="WhatsApp reminder" />
                    <IconBtn icon={Download} onClick={() => downloadPdf(invoicePdfUrl(i.id), `invoice-${i.number}.pdf`).catch((e) => onError(e.message))} title="Download PDF" />
                    <IconBtn icon={Edit2} onClick={() => setModal({ mode: "edit", data: i })} title="Edit" />
                    <IconBtn icon={Trash2} tone="danger" onClick={() => setConfirmDel(i)} title="Delete" />
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {modal && <Modal title={modal.mode === "add" ? "Add Invoice" : "Edit Invoice"} onClose={() => setModal(null)}><InvoiceForm initial={modal.data} clients={clients} projects={projects} nextNumber={nextNumber} onCancel={() => setModal(null)} onSave={(f) => { modal.mode === "add" ? onAdd(f) : onUpdate(modal.data.id, f); setModal(null); }} /></Modal>}
      {confirmDel && <ConfirmDialog text={`Delete invoice "${confirmDel.number}"?`} onCancel={() => setConfirmDel(null)} onConfirm={() => { onDelete(confirmDel.id); setConfirmDel(null); }} />}
    </div>
  );
}

/* ============================== CONTRACTS ============================== */
function ContractForm({ initial, clients, projects, onSave, onCancel }) {
  const [f, setF] = useState(initial || { title: "", type: "Scope of Work (SOW)", client_id: clients[0]?.id || "", project_id: "", value: "", status: "Draft", date: todayISO(), terms: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const clientProjects = projects.filter((p) => p.client_id === f.client_id);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(f); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Field label="Document title *"><Input required value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Scope of Work — Website Redesign" /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Type"><Select value={f.type} onChange={(e) => set("type", e.target.value)}>{CONTRACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{CONTRACT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field>
        <Field label="Client"><Select value={f.client_id} onChange={(e) => set("client_id", e.target.value)}><option value="">— None —</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}</Select></Field>
        <Field label="Project"><Select value={f.project_id} onChange={(e) => set("project_id", e.target.value)}><option value="">— None —</option>{clientProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="Contract value (₹)"><Input type="number" value={f.value} onChange={(e) => set("value", e.target.value)} /></Field>
        <Field label="Date"><Input type="date" value={f.date || ""} onChange={(e) => set("date", e.target.value)} /></Field>
      </div>
      <Field label="Key terms / scope summary"><TextArea rows={4} value={f.terms} onChange={(e) => set("terms", e.target.value)} placeholder="Deliverables, payment schedule, revision terms, timeline..." /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}><Btn variant="outline" onClick={onCancel}>Cancel</Btn><Btn type="submit" variant="solid">Save Document</Btn></div>
    </form>
  );
}
function ContractPreview({ contract, client, project, onClose }) {
  return (
    <Modal title="Document Preview" onClose={onClose} width={620}>
      <div id="contract-print-area" style={{ background: "#fff", color: "#111", borderRadius: 8, padding: 32, fontFamily: FONT_BODY }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #111", paddingBottom: 16, marginBottom: 20 }}>
          <div><div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700 }}>{AGENCY.name}</div><div style={{ fontSize: 11.5, color: "#555", marginTop: 2 }}>{AGENCY.tagline}</div></div>
          <div style={{ textAlign: "right", fontSize: 11.5, color: "#555" }}><div>{AGENCY.domain}</div><div>{AGENCY.email}</div></div>
        </div>
        <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>{contract.type}</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 700, marginTop: 4, marginBottom: 16 }}>{contract.title}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12.5, marginBottom: 18 }}>
          <div><strong>Client:</strong> {client?.company || "—"}</div><div><strong>Date:</strong> {formatDate(contract.date)}</div>
          <div><strong>Project:</strong> {project?.name || "—"}</div><div><strong>Contract Value:</strong> {contract.value ? formatINR(contract.value) : "—"}</div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8, color: "#333" }}>Scope & Terms</div>
        <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "#222" }}>{contract.terms || "—"}</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40, paddingTop: 20, borderTop: "1px solid #ddd" }}>
          <div style={{ fontSize: 11.5, color: "#888" }}><div>Authorized for {AGENCY.name}</div><div style={{ marginTop: 24, borderTop: "1px solid #999", width: 160 }} /></div>
          <div style={{ fontSize: 11.5, color: "#888" }}><div>Accepted by {client?.company || "Client"}</div><div style={{ marginTop: 24, borderTop: "1px solid #999", width: 160 }} /></div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Btn variant="outline" icon={Download} onClick={() => downloadPdf(contractPdfUrl(contract.id), `${(contract.title || "contract").slice(0, 40)}.pdf`).catch(() => {})}>Download PDF</Btn>
        <Btn variant="outline" icon={Printer} onClick={() => window.print()}>Print</Btn>
      </div>
    </Modal>
  );
}
function ContractsPage({ contracts, clients, projects, onAdd, onUpdate, onDelete, onError }) {
  const [modal, setModal] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [preview, setPreview] = useState(null);
  const clientName = (id) => clients.find((c) => c.id === id)?.company || "—";
  return (
    <div style={{ padding: "0 32px 40px" }}>
      <Topbar title="Contracts" subtitle="Scope of Work, agreements and other client documents" action={<Btn icon={Plus} onClick={() => setModal({ mode: "add" })}>New Document</Btn>} />
      {contracts.length === 0 ? (
        <div style={{ marginTop: 20 }}><Card><EmptyState icon={FileText} title="No documents yet" subtitle="Generate a Scope of Work or Software Development Agreement for a client." action={<Btn icon={Plus} onClick={() => setModal({ mode: "add" })}>New Document</Btn>} /></Card></div>
      ) : (
        <Card style={{ overflow: "hidden", marginTop: 18 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>{["Document", "Type", "Client", "Value", "Status", ""].map((h) => <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 11.5, color: C.textFaint, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{h}</th>)}</tr></thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer" }} onClick={() => setPreview(c)} onMouseEnter={(e) => e.currentTarget.style.background = C.hover} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: C.text, fontWeight: 500 }}>{c.title}</td>
                  <td style={{ padding: "13px 16px", fontSize: 12.5, color: C.textDim }}>{c.type}</td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: C.textDim }}>{clientName(c.client_id)}</td>
                  <td style={{ padding: "13px 16px", fontFamily: FONT_MONO, fontSize: 13, color: C.accentBright }}>{c.value ? formatINR(c.value) : "—"}</td>
                  <td style={{ padding: "13px 16px" }}><Badge tone={contractTone(c.status)}>{c.status}</Badge></td>
                  <td style={{ padding: "13px 16px" }} onClick={(e) => e.stopPropagation()}><div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <IconBtn icon={Download} onClick={() => downloadPdf(contractPdfUrl(c.id), `${(c.title || "contract").slice(0, 40)}.pdf`).catch((e) => onError(e.message))} title="Download PDF" />
                    <IconBtn icon={Edit2} onClick={() => setModal({ mode: "edit", data: c })} title="Edit" />
                    <IconBtn icon={Trash2} tone="danger" onClick={() => setConfirmDel(c)} title="Delete" />
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {modal && <Modal title={modal.mode === "add" ? "New Document" : "Edit Document"} onClose={() => setModal(null)}><ContractForm initial={modal.data} clients={clients} projects={projects} onCancel={() => setModal(null)} onSave={(f) => { modal.mode === "add" ? onAdd(f) : onUpdate(modal.data.id, f); setModal(null); }} /></Modal>}
      {confirmDel && <ConfirmDialog text={`Delete "${confirmDel.title}"?`} onCancel={() => setConfirmDel(null)} onConfirm={() => { onDelete(confirmDel.id); setConfirmDel(null); }} />}
      {preview && <ContractPreview contract={preview} client={clients.find((c) => c.id === preview.client_id)} project={projects.find((p) => p.id === preview.project_id)} onClose={() => setPreview(null)} />}
    </div>
  );
}

/* ============================== AUTOMATION ============================== */
function Toggle({ value, onChange, label, description, master }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: master ? "16px 18px" : "13px 18px",
        borderRadius: master ? 10 : 8,
        background: master ? (value ? "rgba(203,161,53,0.08)" : C.dangerDim) : C.surface2,
        border: `1px solid ${master ? (value ? C.accentBorder : "rgba(217,112,122,0.35)") : C.border}`,
        cursor: "pointer", transition: "all 0.2s ease", userSelect: "none",
      }}
    >
      <div>
        <div style={{ fontSize: master ? 14.5 : 13.5, fontWeight: 600, color: C.text }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: C.textDim, marginTop: 3 }}>{description}</div>}
      </div>
      <div style={{ flexShrink: 0, marginLeft: 12 }}>
        {value
          ? <ToggleRight size={master ? 30 : 24} color={C.accent} />
          : <ToggleLeft size={master ? 30 : 24} color={C.textFaint} />}
      </div>
    </div>
  );
}

function AutomationPage({ onError }) {
  const [settings, setSettings] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([automationApi.getSettings(), automationApi.getLogs()]);
      setSettings(s);
      setLogs(l);
    } catch (e) {
      onError(e.message || "Failed to load automation data.");
    } finally {
      setLogsLoading(false);
    }
  }, [onError]);

  useEffect(() => { load(); }, [load]);

  // Refresh logs every 30 seconds
  useEffect(() => {
    const id = setInterval(async () => {
      try { const l = await automationApi.getLogs(); setLogs(l); } catch (_) {}
    }, 30000);
    return () => clearInterval(id);
  }, []);

  async function patch(key, value) {
    try {
      const updated = await automationApi.updateSettings({ [key]: value });
      setSettings(updated);
    } catch (e) {
      onError(e.message || "Failed to save setting.");
    }
  }

  const logStatusTone = (s) => s === "success" ? "success" : s === "failed" ? "danger" : "default";

  const formatTs = (ts) => {
    if (!ts) return "—";
    try { return new Date(ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
    catch (_) { return ts; }
  };

  return (
    <div style={{ padding: "0 32px 40px" }}>
      <Topbar
        title="Automation"
        subtitle="WhatsApp outreach links, document generation, and audit trail"
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Activity size={14} color={C.textFaint} />
            <span style={{ fontSize: 12, color: C.textFaint }}>{logs.length} log entries</span>
          </div>
        }
      />

      {!settings ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: C.textFaint, fontSize: 13 }}>Loading settings…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 24 }}>

          {/* Settings card */}
          <Card style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
              <Settings2 size={15} color={C.accent} />
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: C.text }}>Automation Settings</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Toggle
                master
                value={settings.automation_enabled}
                onChange={(v) => patch("automation_enabled", v)}
                label={settings.automation_enabled ? "🟢 Automation is ON" : "🔴 Automation is OFF"}
                description={settings.automation_enabled
                  ? "Active — triggers will fire on leads, projects, and invoices."
                  : "Kill switch engaged — nothing fires. Turn on to activate all triggers below."}
              />
              <div style={{ height: 8 }} />
              <Toggle
                value={settings.auto_acknowledge_leads}
                onChange={(v) => patch("auto_acknowledge_leads", v)}
                label="Auto-acknowledge new leads"
                description="Prepares a WhatsApp link when a new lead is added."
              />
              <Toggle
                value={settings.auto_generate_sow_on_won}
                onChange={(v) => patch("auto_generate_sow_on_won", v)}
                label="Generate SOW when lead is Won"
                description="Creates a Client, Project, and draft Scope of Work contract automatically."
              />
              <Toggle
                value={settings.auto_invoice_on_project_complete}
                onChange={(v) => patch("auto_invoice_on_project_complete", v)}
                label="Create final invoice when project completes"
                description="Generates a draft invoice for the remaining budget balance."
              />
              <Toggle
                value={settings.auto_whatsapp_invoice_reminders}
                onChange={(v) => patch("auto_whatsapp_invoice_reminders", v)}
                label="WhatsApp reminders for invoices"
                description="Prepares reminder links for sent invoices nearing or past their due date."
              />
            </div>
          </Card>

          {/* Activity log */}
          <Card style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
              <Activity size={15} color={C.accent} />
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: C.text }}>Activity Log</div>
              <span style={{ fontSize: 11.5, color: C.textFaint, marginLeft: 4 }}>— refreshes every 30 s</span>
            </div>
            {logsLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: C.textFaint, fontSize: 13 }}>Loading…</div>
            ) : logs.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No automation activity yet"
                subtitle="Enable automation above, then create a lead or move one to Won to see entries here."
              />
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {["Event", "Action", "Status", "When", ""].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "11px 16px", fontSize: 11, color: C.textFaint, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((entry) => (
                    <tr key={entry.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "11px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: C.textDim, whiteSpace: "nowrap" }}>{entry.event}</td>
                      <td style={{ padding: "11px 16px", fontSize: 12.5, color: C.text, maxWidth: 280 }}>{entry.action}</td>
                      <td style={{ padding: "11px 16px" }}><Badge tone={logStatusTone(entry.status)}>{entry.status}</Badge></td>
                      <td style={{ padding: "11px 16px", fontSize: 11.5, color: C.textFaint, whiteSpace: "nowrap" }}>{formatTs(entry.created_at)}</td>
                      <td style={{ padding: "11px 16px" }}>
                        {entry.detail && entry.detail.startsWith("https://wa.me/") && (
                          <a
                            href={entry.detail}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              fontSize: 12, color: C.success, textDecoration: "none",
                              background: C.successDim, padding: "4px 10px", borderRadius: 7,
                              border: "1px solid rgba(99,180,138,0.35)",
                            }}
                          >
                            <MessageCircle size={12} /> Open WhatsApp
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

        </div>
      )}
    </div>
  );
}


/* ============================== TASKS PAGE ============================== */
const TASK_RELATED_TYPES = ["", "lead", "client", "project"];

function TaskForm({ initial, leads, clients, projects, onSave, onCancel }) {
  const [f, setF] = useState(initial || { title: "", description: "", due_date: "", status: "Pending", related_type: "", related_id: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const relatedOptions = f.related_type === "lead" ? leads : f.related_type === "client" ? clients : f.related_type === "project" ? projects : [];
  const relatedLabel = (item) => item.company || item.name || item.title || item.id;
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...f, due_date: f.due_date || null, related_id: f.related_id || null }); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Field label="Task title *"><Input required value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Follow up with Ketone Gym" /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Due date"><Input type="date" value={f.due_date || ""} onChange={(e) => set("due_date", e.target.value)} /></Field>
        <Field label="Status">
          <Select value={f.status} onChange={(e) => set("status", e.target.value)}>
            <option value="Pending">Pending</option>
            <option value="Done">Done</option>
          </Select>
        </Field>
        <Field label="Related to">
          <Select value={f.related_type} onChange={(e) => { set("related_type", e.target.value); set("related_id", ""); }}>
            <option value="">— None —</option>
            <option value="lead">Lead</option>
            <option value="client">Client</option>
            <option value="project">Project</option>
          </Select>
        </Field>
        {f.related_type && (
          <Field label={f.related_type.charAt(0).toUpperCase() + f.related_type.slice(1)}>
            <Select value={f.related_id} onChange={(e) => set("related_id", e.target.value)}>
              <option value="">— Select —</option>
              {relatedOptions.map((item) => <option key={item.id} value={item.id}>{relatedLabel(item)}</option>)}
            </Select>
          </Field>
        )}
      </div>
      <Field label="Notes / description"><TextArea value={f.description} onChange={(e) => set("description", e.target.value)} rows={2} /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}><Btn variant="outline" onClick={onCancel}>Cancel</Btn><Btn type="submit" variant="solid">Save Task</Btn></div>
    </form>
  );
}

function TasksPage({ tasks, leads, clients, projects, onAdd, onUpdate, onDelete }) {
  const [modal, setModal] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const today = todayISO();

  const getRelatedLabel = (task) => {
    if (!task.related_type || !task.related_id) return null;
    const arr = task.related_type === "lead" ? leads : task.related_type === "client" ? clients : task.related_type === "project" ? projects : [];
    const item = arr.find((x) => x.id === task.related_id);
    if (!item) return null;
    return { type: task.related_type, name: item.company || item.name || "—" };
  };

  const groups = [
    { label: "Overdue", tone: "danger", items: tasks.filter((t) => t.status === "Pending" && t.due_date && t.due_date < today) },
    { label: "Today", tone: "warning", items: tasks.filter((t) => t.status === "Pending" && t.due_date === today) },
    { label: "Upcoming", tone: "default", items: tasks.filter((t) => t.status === "Pending" && (!t.due_date || t.due_date > today)) },
    { label: "Done", tone: "success", items: tasks.filter((t) => t.status === "Done") },
  ];

  return (
    <div style={{ padding: "0 32px 40px" }}>
      <Topbar title="Tasks" subtitle="Reminders, follow-ups and to-dos linked to your pipeline" action={<Btn icon={Plus} onClick={() => setModal({ mode: "add" })}>Add Task</Btn>} />
      <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 22 }}>
        {groups.map(({ label, tone, items }) => (
          items.length === 0 ? null : (
            <div key={label}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: C.textFaint, letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</span>
                <span style={{ fontSize: 11, color: C.textFaint, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 999, padding: "0 6px", fontFamily: FONT_MONO }}>{items.length}</span>
              </div>
              <Card style={{ overflow: "hidden" }}>
                {items.map((task, idx) => {
                  const rel = getRelatedLabel(task);
                  return (
                    <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: idx < items.length - 1 ? `1px solid ${C.border}` : "none" }}>
                      <button onClick={() => onUpdate(task.id, { status: task.status === "Done" ? "Pending" : "Done" })}
                        style={{ background: "none", border: "none", cursor: "pointer", color: task.status === "Done" ? C.success : C.textFaint, padding: 0, display: "flex", flexShrink: 0 }}>
                        {task.status === "Done" ? <CheckSquare size={16} strokeWidth={2} /> : <Square size={16} strokeWidth={1.8} />}
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, color: task.status === "Done" ? C.textFaint : C.text, fontWeight: 500, textDecoration: task.status === "Done" ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</div>
                        <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap", alignItems: "center" }}>
                          {task.due_date && <span style={{ fontSize: 11, color: label === "Overdue" ? C.danger : C.textFaint }}>{formatDate(task.due_date)}</span>}
                          {rel && <Badge tone={rel.type === "lead" ? "info" : rel.type === "client" ? "success" : "accent"}>{rel.type}: {rel.name}</Badge>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <IconBtn icon={Edit2} onClick={() => setModal({ mode: "edit", data: task })} title="Edit" />
                        <IconBtn icon={Trash2} tone="danger" onClick={() => setConfirmDel(task)} title="Delete" />
                      </div>
                    </div>
                  );
                })}
              </Card>
            </div>
          )
        ))}
        {tasks.length === 0 && (
          <Card><EmptyState icon={ListTodo} title="No tasks yet" subtitle="Add tasks to track follow-ups, reminders and project to-dos." action={<Btn icon={Plus} onClick={() => setModal({ mode: "add" })}>Add your first task</Btn>} /></Card>
        )}
      </div>
      {modal && <Modal title={modal.mode === "add" ? "Add Task" : "Edit Task"} onClose={() => setModal(null)}><TaskForm initial={modal.data} leads={leads} clients={clients} projects={projects} onCancel={() => setModal(null)} onSave={(f) => { modal.mode === "add" ? onAdd(f) : onUpdate(modal.data.id, f); setModal(null); }} /></Modal>}
      {confirmDel && <ConfirmDialog text={`Delete task "${confirmDel.title}"?`} onCancel={() => setConfirmDel(null)} onConfirm={() => { onDelete(confirmDel.id); setConfirmDel(null); }} />}
    </div>
  );
}

/* ============================== GLOBAL SEARCH MODAL ============================== */
function GlobalSearchModal({ onClose, setPage, setOpenDetailClientId, setOpenDetailProjectId }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (q.length < 2) { setResults(null); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await searchApi(q);
        setResults(data);
      } catch (_) {}
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const hasResults = results && (results.clients?.length || results.leads?.length || results.projects?.length || results.invoices?.length || results.contracts?.length);

  function handleResult(type, item) {
    onClose();
    const pageMap = { clients: "clients", leads: "leads", projects: "projects", invoices: "invoices", contracts: "contracts" };
    setPage(pageMap[type] || type);
    if (type === "clients") setOpenDetailClientId(item.id);
    if (type === "projects") setOpenDetailProjectId(item.id);
  }

  const CATEGORIES = [
    { key: "clients", label: "Clients" },
    { key: "leads", label: "Leads" },
    { key: "projects", label: "Projects" },
    { key: "invoices", label: "Invoices" },
    { key: "contracts", label: "Contracts" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(6,6,8,0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 200, padding: "10vh 20px" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 14, width: "100%", maxWidth: 540, boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
          <Search size={16} color={C.textFaint} strokeWidth={2} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search clients, leads, projects, invoices, contracts…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 14, fontFamily: FONT_BODY }}
          />
          {loading && <Loader2 size={15} color={C.textFaint} style={{ animation: "spin 0.8s linear infinite" }} />}
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 5, color: C.textFaint, cursor: "pointer", padding: "2px 6px", fontSize: 10.5, fontFamily: FONT_MONO }}>ESC</button>
        </div>
        <div style={{ maxHeight: "60vh", overflowY: "auto", padding: q.length >= 2 ? "8px 0" : 0 }}>
          {q.length < 2 && (
            <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 13, color: C.textFaint }}>Type at least 2 characters to search…</div>
          )}
          {q.length >= 2 && !loading && !hasResults && results && (
            <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 13, color: C.textFaint }}>No results for "{q}"</div>
          )}
          {results && CATEGORIES.map(({ key, label }) => {
            const items = results[key] || [];
            if (!items.length) return null;
            return (
              <div key={key}>
                <div style={{ padding: "8px 16px 4px", fontSize: 10.5, fontWeight: 700, color: C.textFaint, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
                {items.map((item) => (
                  <button key={item.id} onClick={() => handleResult(key, item)}
                    style={{ width: "100%", display: "flex", flexDirection: "column", padding: "8px 16px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", borderRadius: 0 }}
                    onMouseEnter={(e) => e.currentTarget.style.background = C.hover}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    <span style={{ fontSize: 13.5, color: C.text, fontWeight: 500 }}>{item.label}</span>
                    {item.subtitle && <span style={{ fontSize: 11.5, color: C.textFaint, marginTop: 1 }}>{item.subtitle}</span>}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================== PUBLIC LEAD CAPTURE FORM ============================== */
function LeadCaptureForm() {
  const [f, setF] = useState({ company: "", contact_name: "", email: "", phone: "", message: "", website: "" });
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [errMsg, setErrMsg] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("loading");
    try {
      await submitPublicLead(f);
      setStatus("success");
    } catch (err) {
      setErrMsg(err.message || "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FONT_BODY }}>
        <div style={{ textAlign: "center", maxWidth: 440 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <CheckCircle2 size={30} color={C.accent} />
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, color: C.text, marginBottom: 10 }}>Thank you!</div>
          <div style={{ fontSize: 15, color: C.textDim, lineHeight: 1.7 }}>We've received your enquiry and will get back to you shortly. In the meantime, check out our work at <a href="https://radiusstudios.in" style={{ color: C.accent }}>radiusstudios.in</a>.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", fontFamily: FONT_BODY }}>
      <div style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/logo.png" alt="Radius Studios" style={{ height: 44, objectFit: "contain", marginBottom: 16 }} />
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, color: C.text, letterSpacing: -0.5 }}>Work with Radius Studios</div>
          <div style={{ fontSize: 15, color: C.textDim, marginTop: 8 }}>Tell us about your project and we'll reach out within 24 hours.</div>
        </div>
        <Card style={{ padding: 28 }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Honeypot — hidden from real users, bots will fill this */}
            <input
              type="text"
              value={f.website}
              onChange={(e) => set("website", e.target.value)}
              tabIndex={-1}
              aria-hidden="true"
              style={{ display: "none" }}
              autoComplete="off"
            />
            <Field label="Business / project name *"><Input required value={f.company} onChange={(e) => set("company", e.target.value)} placeholder="e.g. Ketone Gym & Fitness" /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Your name *"><Input required value={f.contact_name} onChange={(e) => set("contact_name", e.target.value)} placeholder="Full name" /></Field>
              <Field label="Phone"><Input type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" /></Field>
            </div>
            <Field label="Email *"><Input required type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" /></Field>
            <Field label="Tell us about your project"><TextArea rows={4} value={f.message} onChange={(e) => set("message", e.target.value)} placeholder="Describe what you need — website redesign, web app, branding, etc." /></Field>
            {status === "error" && <div style={{ fontSize: 12.5, color: C.danger, background: C.dangerDim, padding: "8px 12px", borderRadius: 7 }}>{errMsg}</div>}
            <Btn type="submit" variant="solid" disabled={status === "loading"} style={{ justifyContent: "center", padding: "12px 20px", fontSize: 14, marginTop: 4 }}>
              {status === "loading" ? "Sending…" : "Send enquiry →"}
            </Btn>
          </form>
        </Card>
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12.5, color: C.textFaint }}>
          <a href="https://radiusstudios.in" style={{ color: C.textFaint, textDecoration: "none" }}>radiusstudios.in</a> · <a href="mailto:radiusstudio.co@gmail.com" style={{ color: C.textFaint, textDecoration: "none" }}>radiusstudio.co@gmail.com</a>
        </div>
      </div>
    </div>
  );
}

/* ============================== APP ROOT ============================== */

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);

  const [page, setPage] = useState("dashboard");
  const [dataLoading, setDataLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");

  // Global search modal
  const [showSearch, setShowSearch] = useState(false);
  // For navigating from search results → open detail modal on target page
  const [openDetailClientId, setOpenDetailClientId] = useState(null);
  const [openDetailProjectId, setOpenDetailProjectId] = useState(null);

  const loadAll = useCallback(async () => {
    setDataLoading(true);
    try {
      const [l, c, p, i, ct, an, ts] = await Promise.all([
        leadsApi.list(), clientsApi.list(), projectsApi.list(), invoicesApi.list(), contractsApi.list(), fetchAnalytics(), tasksApi.list(),
      ]);
      setLeads(l); setClients(c); setProjects(p); setInvoices(i); setContracts(ct); setAnalytics(an); setTasks(ts);
    } catch (e) {
      setError(e.message || "Failed to load data.");
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const token = getToken();
      if (token) {
        try {
          await fetchMe();
          setAuthed(true);
          loadAll();
        } catch (e) {
          clearToken();
        }
      }
      try {
        const status = await bootstrapStatus();
        setNeedsBootstrap(status.needs_bootstrap);
      } catch (e) {
        setNeedsBootstrap(false);
      }
      setAuthChecked(true);
    })();
    const onUnauthorized = () => setAuthed(false);
    window.addEventListener("radius-crm-unauthorized", onUnauthorized);
    return () => window.removeEventListener("radius-crm-unauthorized", onUnauthorized);
  }, [loadAll]);

  // Cmd+K / Ctrl+K global shortcut to open search
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch((v) => !v);
      }
      if (e.key === "Escape") setShowSearch(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Clear transient openDetail IDs after a short delay (so the page has mounted)
  useEffect(() => {
    if (openDetailClientId) { const t = setTimeout(() => setOpenDetailClientId(null), 800); return () => clearTimeout(t); }
  }, [openDetailClientId]);
  useEffect(() => {
    if (openDetailProjectId) { const t = setTimeout(() => setOpenDetailProjectId(null), 800); return () => clearTimeout(t); }
  }, [openDetailProjectId]);

  function handleLoggedIn() {
    setAuthed(true);
    loadAll();
  }
  function handleLogout() {
    clearToken();
    setAuthed(false);
  }

  function wrapAction(fn) {
    return async (...args) => {
      try {
        await fn(...args);
      } catch (e) {
        setError(e.message || "Something went wrong.");
      }
    };
  }

  const leadsCrud = {
    add: wrapAction(async (f) => { const created = await leadsApi.create({ ...f, value: Number(f.value) || 0 }); setLeads((s) => [created, ...s]); }),
    update: wrapAction(async (id, f) => { const updated = await leadsApi.update(id, f); setLeads((s) => s.map((x) => x.id === id ? updated : x)); }),
    remove: wrapAction(async (id) => { await leadsApi.remove(id); setLeads((s) => s.filter((x) => x.id !== id)); }),
  };
  const clientsCrud = {
    add: wrapAction(async (f) => { const created = await clientsApi.create(f); setClients((s) => [created, ...s]); }),
    update: wrapAction(async (id, f) => { const updated = await clientsApi.update(id, f); setClients((s) => s.map((x) => x.id === id ? updated : x)); }),
    remove: wrapAction(async (id) => { await clientsApi.remove(id); setClients((s) => s.filter((x) => x.id !== id)); setProjects((s) => s.filter((x) => x.client_id !== id)); }),
  };
  const projectsCrud = {
    add: wrapAction(async (f) => { const created = await projectsApi.create({ ...f, budget: Number(f.budget) || 0, client_id: f.client_id || null }); setProjects((s) => [created, ...s]); }),
    update: wrapAction(async (id, f) => { const updated = await projectsApi.update(id, f); setProjects((s) => s.map((x) => x.id === id ? updated : x)); }),
    remove: wrapAction(async (id) => { await projectsApi.remove(id); setProjects((s) => s.filter((x) => x.id !== id)); }),
  };
  const invoicesCrud = {
    add: wrapAction(async (f) => { const created = await invoicesApi.create({ ...f, amount: Number(f.amount) || 0, client_id: f.client_id || null, project_id: f.project_id || null }); setInvoices((s) => [created, ...s]); setAnalytics(await fetchAnalytics()); }),
    update: wrapAction(async (id, f) => { const updated = await invoicesApi.update(id, f); setInvoices((s) => s.map((x) => x.id === id ? updated : x)); setAnalytics(await fetchAnalytics()); }),
    remove: wrapAction(async (id) => { await invoicesApi.remove(id); setInvoices((s) => s.filter((x) => x.id !== id)); setAnalytics(await fetchAnalytics()); }),
  };
  const contractsCrud = {
    add: wrapAction(async (f) => { const created = await contractsApi.create({ ...f, value: Number(f.value) || 0, client_id: f.client_id || null, project_id: f.project_id || null }); setContracts((s) => [created, ...s]); }),
    update: wrapAction(async (id, f) => { const updated = await contractsApi.update(id, f); setContracts((s) => s.map((x) => x.id === id ? updated : x)); }),
    remove: wrapAction(async (id) => { await contractsApi.remove(id); setContracts((s) => s.filter((x) => x.id !== id)); }),
  };
  const tasksCrud = {
    add: wrapAction(async (f) => { const created = await tasksApi.create(f); setTasks((s) => [created, ...s]); }),
    update: wrapAction(async (id, f) => { const updated = await tasksApi.update(id, f); setTasks((s) => s.map((x) => x.id === id ? updated : x)); }),
    remove: wrapAction(async (id) => { await tasksApi.remove(id); setTasks((s) => s.filter((x) => x.id !== id)); }),
  };

  // Authenticated shell content (used by the default route)
  function AuthedShell() {
    if (!authChecked) return <div style={{ minHeight: "100vh", background: C.bg }} />;
    if (!authed) return <LoginScreen onLoggedIn={handleLoggedIn} needsBootstrap={needsBootstrap} setNeedsBootstrap={setNeedsBootstrap} />;

    const counts = { leads: leads.length, clients: clients.length, projects: projects.length, invoices: invoices.length, contracts: contracts.length, tasks: tasks.filter((t) => t.status === "Pending").length };

    return (
      <div style={{ fontFamily: FONT_BODY, background: C.bg, minHeight: "100vh", color: C.text }}>
        <ErrorBanner message={error} onDismiss={() => setError("")} />
        {showSearch && (
          <GlobalSearchModal
            onClose={() => setShowSearch(false)}
            setPage={(p) => { setPage(p); setShowSearch(false); }}
            setOpenDetailClientId={setOpenDetailClientId}
            setOpenDetailProjectId={setOpenDetailProjectId}
          />
        )}
        {dataLoading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${C.border}`, borderTopColor: C.accent, animation: "spin 0.8s linear infinite" }} />
            <div style={{ fontSize: 13, color: C.textFaint }}>Loading your workspace...</div>
          </div>
        ) : (
          <div style={{ display: "flex" }}>
            <Sidebar page={page} setPage={setPage} counts={counts} onLogout={handleLogout} onOpenSearch={() => setShowSearch(true)} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {page === "dashboard" && <Dashboard leads={leads} clients={clients} projects={projects} invoices={invoices} analytics={analytics} tasks={tasks} onToggleTask={(t) => tasksCrud.update(t.id, { status: t.status === "Done" ? "Pending" : "Done" })} setPage={setPage} />}
              {page === "leads" && <LeadsPage leads={leads} onAdd={leadsCrud.add} onUpdate={leadsCrud.update} onDelete={leadsCrud.remove} onError={setError} />}
              {page === "clients" && <ClientsPage clients={clients} projects={projects} onAdd={clientsCrud.add} onUpdate={clientsCrud.update} onDelete={clientsCrud.remove} openDetailId={openDetailClientId} />}
              {page === "projects" && <ProjectsPage projects={projects} clients={clients} invoices={invoices} onAdd={projectsCrud.add} onUpdate={projectsCrud.update} onDelete={projectsCrud.remove} openDetailId={openDetailProjectId} />}
              {page === "invoices" && <InvoicesPage invoices={invoices} clients={clients} projects={projects} onAdd={invoicesCrud.add} onUpdate={invoicesCrud.update} onDelete={invoicesCrud.remove} onError={setError} />}
              {page === "contracts" && <ContractsPage contracts={contracts} clients={clients} projects={projects} onAdd={contractsCrud.add} onUpdate={contractsCrud.update} onDelete={contractsCrud.remove} onError={setError} />}
              {page === "tasks" && <TasksPage tasks={tasks} leads={leads} clients={clients} projects={projects} onAdd={tasksCrud.add} onUpdate={tasksCrud.update} onDelete={tasksCrud.remove} />}
              {page === "automation" && <AutomationPage onError={setError} />}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/apply" element={<LeadCaptureForm />} />
      <Route path="*" element={<AuthedShell />} />
    </Routes>
  );
}
