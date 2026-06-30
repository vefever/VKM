// Local user invite store (Phase 1 - moves to Supabase later).
// Persists invited users in localStorage, grouped by role.

export type InviteRole = "participant" | "coach" | "mentor";

export type InvitedUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: InviteRole;
  status: "Invited" | "Active";
  invitedAt: string; // ISO
  batch?: string;
};

const KEY = "vkm.invitedUsers.v1";

function read(): InvitedUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as InvitedUser[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(users: InvitedUser[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(users));
  window.dispatchEvent(new CustomEvent("vkm:users-changed"));
}

function seed(): InvitedUser[] {
  const now = new Date().toISOString();
  const demo: InvitedUser[] = [
    { id: cryptoId(), name: "Riya Sharma",  email: "riya@example.com",  role: "participant", status: "Active",  invitedAt: now, batch: "Batch 16" },
    { id: cryptoId(), name: "Arjun Mehta",  email: "arjun@example.com", role: "participant", status: "Invited", invitedAt: now, batch: "Batch 16" },
    { id: cryptoId(), name: "Kavya Reddy",  email: "kavya@example.com", role: "coach",       status: "Active",  invitedAt: now },
    { id: cryptoId(), name: "Soumya Iyer",  email: "soumya@example.com", role: "mentor",     status: "Active",  invitedAt: now },
  ];
  write(demo);
  return demo;
}

function cryptoId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const userStore = {
  list(): InvitedUser[] {
    return read();
  },
  listByRole(role: InviteRole): InvitedUser[] {
    return read().filter((u) => u.role === role);
  },
  invite(input: Omit<InvitedUser, "id" | "status" | "invitedAt">): InvitedUser {
    const user: InvitedUser = {
      ...input,
      id: cryptoId(),
      status: "Invited",
      invitedAt: new Date().toISOString(),
    };
    const all = read();
    if (all.some((u) => u.email.toLowerCase() === user.email.toLowerCase())) {
      throw new Error(`A user with email ${user.email} already exists.`);
    }
    write([user, ...all]);
    return user;
  },
  importMany(rows: Array<Omit<InvitedUser, "id" | "status" | "invitedAt">>): { added: number; skipped: number } {
    const all = read();
    const seen = new Set(all.map((u) => u.email.toLowerCase()));
    let added = 0;
    let skipped = 0;
    for (const r of rows) {
      const email = r.email?.trim().toLowerCase();
      if (!email || seen.has(email)) { skipped++; continue; }
      all.unshift({
        ...r,
        email,
        id: cryptoId(),
        status: "Invited",
        invitedAt: new Date().toISOString(),
      });
      seen.add(email);
      added++;
    }
    write(all);
    return { added, skipped };
  },
  remove(id: string) {
    write(read().filter((u) => u.id !== id));
  },
  setStatus(id: string, status: InvitedUser["status"]) {
    write(read().map((u) => (u.id === id ? { ...u, status } : u)));
  },
  subscribe(fn: () => void): () => void {
    if (typeof window === "undefined") return () => {};
    const handler = () => fn();
    window.addEventListener("vkm:users-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("vkm:users-changed", handler);
      window.removeEventListener("storage", handler);
    };
  },
};

// --- CSV helpers ---
export const CSV_TEMPLATE =
  "name,email,role,phone,batch\nRiya Sharma,riya@example.com,participant,+91-9000000001,Batch 16\nKavya Reddy,kavya@example.com,coach,,\nSoumya Iyer,soumya@example.com,mentor,,\n";

export function parseUsersCsv(text: string): {
  rows: Array<Omit<InvitedUser, "id" | "status" | "invitedAt">>;
  errors: string[];
} {
  const errors: string[] = [];
  const rows: Array<Omit<InvitedUser, "id" | "status" | "invitedAt">> = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows, errors: ["File is empty"] };
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (k: string) => header.indexOf(k);
  const iName = idx("name"), iEmail = idx("email"), iRole = idx("role"), iPhone = idx("phone"), iBatch = idx("batch");
  if (iName < 0 || iEmail < 0 || iRole < 0) {
    return { rows, errors: ["CSV must include name, email, role columns"] };
  }
  for (let r = 1; r < lines.length; r++) {
    const cells = lines[r].split(",").map((c) => c.trim());
    const role = (cells[iRole] || "").toLowerCase() as InviteRole;
    if (!["participant", "coach", "mentor"].includes(role)) {
      errors.push(`Row ${r + 1}: invalid role "${cells[iRole]}"`);
      continue;
    }
    const email = cells[iEmail] || "";
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      errors.push(`Row ${r + 1}: invalid email "${email}"`);
      continue;
    }
    rows.push({
      name: cells[iName] || email.split("@")[0],
      email,
      role,
      phone: iPhone >= 0 ? cells[iPhone] || undefined : undefined,
      batch: iBatch >= 0 ? cells[iBatch] || undefined : undefined,
    });
  }
  return { rows, errors };
}
