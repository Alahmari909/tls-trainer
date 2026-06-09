import { createContext, useContext } from "react";

interface AdminNavContextValue {
  /** Callback to return to the admin dashboard — only set when inside admin panel */
  goBack?: () => void;
}

export const AdminNavContext = createContext<AdminNavContextValue>({});

/** Returns the goBack fn when rendered inside the admin panel, undefined otherwise */
export function useAdminNav() {
  return useContext(AdminNavContext);
}
