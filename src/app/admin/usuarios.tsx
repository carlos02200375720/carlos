import React, { useState, useMemo } from "react";
import {
  Search,
  ShieldCheck,
  ExternalLink,
  Trash2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { User } from "../../types";
import { apiFetch } from "../../config";
import { isSuperAdmin } from "../../superAdmin";

export interface UsuariosAdminProps {
  currentUser: User;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  onCreatorClick: (creatorId: string) => void;
  onStatusMessage?: (msg: { type: "success" | "error" | "info"; text: string } | null) => void;
  onRequestDeleteUser?: (target: { type: "user"; id: string; name: string }) => void;
}

export default function UsuariosAdminView({
  currentUser,
  users,
  setUsers,
  onCreatorClick,
  onStatusMessage,
  onRequestDeleteUser,
}: UsuariosAdminProps) {
  const [userSearch, setUserSearch] = useState("");
  const [updatingPermissionId, setUpdatingPermissionId] = useState<string | null>(null);
  const [localDeletingUser, setLocalDeletingUser] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const notify = (msg: { type: "success" | "error" | "info"; text: string }) => {
    if (onStatusMessage) {
      onStatusMessage(msg);
      setTimeout(() => onStatusMessage(null), 4000);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        u.id.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const handleToggleSellerPermission = async (user: User) => {
    if (user.id === currentUser.id || updatingPermissionId) return;
    const nextCanSell = user.canSell !== true;
    setUpdatingPermissionId(user.id);
    try {
      const res = await apiFetch(`/api/users/${encodeURIComponent(user.id)}/permission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canSell: nextCanSell }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success !== true) {
        throw new Error(data.error || "No se pudo actualizar el permiso.");
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, canSell: data.canSell === true } : u))
      );
      notify({
        type: "success",
        text: nextCanSell
          ? `@${user.username} ahora tiene permisos de vendedor.`
          : `Se retiraron los permisos de vendedor de @${user.username}.`,
      });
    } catch (err: any) {
      console.error("Error updating seller permission:", err);
      notify({
        type: "error",
        text: err.message || "Error al actualizar el permiso.",
      });
    } finally {
      setUpdatingPermissionId(null);
    }
  };

  const confirmLocalDeleteUser = async () => {
    if (!localDeletingUser) return;
    setIsDeleting(true);
    try {
      const res = await apiFetch(`/api/users/${localDeletingUser.id}`, { method: "DELETE" });
      if (res) {
        setUsers((prev) => prev.filter((u) => u.id !== localDeletingUser.id));
        notify({
          type: "success",
          text: `Usuario @${localDeletingUser.name} eliminado de la base de datos.`,
        });
      }
    } catch (err: any) {
      console.error("Error deleting user in admin:", err);
      notify({
        type: "error",
        text: err.message || "Error al procesar la eliminación",
      });
    } finally {
      setIsDeleting(false);
      setLocalDeletingUser(null);
    }
  };

  return (
    <div
      className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5"
      id="admin-tab-content-users"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">Gestión de Usuarios</h2>
          <p className="text-xs text-slate-500">
            Directorio oficial de cuentas registradas en la base de datos.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Buscar por nombre, username o email..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase font-mono text-[10px] tracking-wider border-y border-slate-100">
            <tr>
              <th className="py-3 px-4">Usuario</th>
              <th className="py-3 px-4">Correo Electrónico</th>
              <th className="py-3 px-4">Seguidores</th>
              <th className="py-3 px-4">Estado</th>
              <th className="py-3 px-4">Permiso</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-400">
                  No se encontraron usuarios que coincidan con la búsqueda.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user, uIdx) => {
                const userIsSuperAdmin = isSuperAdmin(user);
                return (
                  <tr
                    key={`${user.id}-${uIdx}`}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      userIsSuperAdmin ? "bg-amber-500/5" : ""
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3">
                        <img
                          src={
                            user.avatar ||
                            "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"
                          }
                          alt={user.name}
                          className={`w-9 h-9 rounded-full object-cover border shrink-0 ${
                            userIsSuperAdmin
                              ? "border-amber-400 ring-2 ring-amber-400/30"
                              : "border-slate-200"
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-slate-900">{user.name}</p>
                            {userIsSuperAdmin && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 border border-amber-500/30 text-[9px] font-black uppercase tracking-wider">
                                <ShieldCheck className="w-3 h-3 text-amber-600" />
                                <span>Superadmin</span>
                              </span>
                            )}
                          </div>
                          <p className="font-mono text-[11px] text-slate-400">@{user.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {user.email || "No especificado"}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                      {user.followers || 0}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          user.isOnline
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            user.isOnline ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        <span>{user.isOnline ? "En línea" : "Desconectado"}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {userIsSuperAdmin ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-300 font-extrabold text-[11px] shadow-2xs">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>Acceso Total</span>
                          </span>
                          <p className="mt-0.5 text-[9px] font-bold text-amber-700">
                            Superadministrador
                          </p>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleSellerPermission(user)}
                            disabled={updatingPermissionId === user.id}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                              user.canSell ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                            title={
                              user.canSell
                                ? "Permiso activo: publicar, productos y rendimiento"
                                : "Activar permisos de vendedor"
                            }
                            aria-label={
                              user.canSell
                                ? "Desactivar permiso de vendedor"
                                : "Activar permiso de vendedor"
                            }
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                                user.canSell ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                          <p
                            className={`mt-1 text-[9px] font-bold ${
                              user.canSell ? "text-emerald-600" : "text-slate-400"
                            }`}
                          >
                            {updatingPermissionId === user.id
                              ? "Guardando..."
                              : user.canSell
                              ? "Vendedor"
                              : "Normal"}
                          </p>
                        </>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center space-x-2">
                        <button
                          onClick={() => onCreatorClick(user.id)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                          title="Ver perfil"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        {user.id !== currentUser.id && !userIsSuperAdmin && (
                          <button
                            onClick={() => {
                              if (onRequestDeleteUser) {
                                onRequestDeleteUser({
                                  type: "user",
                                  id: user.id,
                                  name: user.username,
                                });
                              } else {
                                setLocalDeletingUser({ id: user.id, name: user.username });
                              }
                            }}
                            className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Fallback Confirmation Modal when used standalone */}
      <AnimatePresence>
        {localDeletingUser && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full shadow-2xl space-y-4 text-slate-900"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-base font-black text-slate-900">¿Confirmar eliminación?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Estás a punto de eliminar de forma permanente el usuario{" "}
                  <span className="font-bold text-slate-900">"{localDeletingUser.name}"</span>.
                  Esta acción no se puede deshacer.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setLocalDeletingUser(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmLocalDeleteUser}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 transition-all flex items-center space-x-1.5"
                >
                  {isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>{isDeleting ? "Eliminando..." : "Eliminar Definitivamente"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
