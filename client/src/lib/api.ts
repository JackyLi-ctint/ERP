import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";

// ─── Auth types ──────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface LeaveType {
  id: number;
  name: string;
  defaultDays: number;
  isCarryForward: boolean;
  requiresDocument: boolean;
  isActive: boolean;
}

export interface LeaveRequest {
  id: number;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  totalDays: number;
  halfDay: boolean;
  period?: string;
  reason?: string;
  status: string;
  leaveType: { id: number; name: string };
  createdAt: string;
}

export interface LeaveBalance {
  id: number;
  userId: string;
  leaveTypeId: number;
  year: number;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  leaveType: { id: number; name: string };
}

export interface PendingRequest {
  id: number;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  totalDays: number;
  halfDay: boolean;
  period?: string;
  reason?: string;
  status: string;
  leaveType: { id: number; name: string };
  user: { id: string; name: string; email: string };
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  team?: string;
  title?: string;
}

// ─── Axios instance ───────────────────────────────────────────────────────────

let accessToken: string | null = null;
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

const apiClient: AxiosInstance = axios.create({
  baseURL: "/api",
});

// Inject access token in all requests
apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Auto-refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      const storedRefreshToken = localStorage.getItem("refreshToken");
      if (!storedRefreshToken) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post<AuthResponse>("/api/auth/refresh", {
          token: storedRefreshToken,
        });
        const newToken = response.data.accessToken;
        setAccessToken(newToken);
        if (response.data.refreshToken) {
          localStorage.setItem("refreshToken", response.data.refreshToken);
        }
        onRefreshed(newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch {
        localStorage.removeItem("refreshToken");
        window.dispatchEvent(new CustomEvent("auth:expired"));
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (credentials: LoginRequest): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>("/auth/login", credentials);
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>("/auth/register", data);
    return response.data;
  },

  refresh: async (refreshToken: string): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>("/auth/refresh", {
      token: refreshToken,
    });
    return response.data;
  },
};

// ─── Leave Requests ───────────────────────────────────────────────────────────

export async function getLeaveRequests(): Promise<LeaveRequest[]> {
  const response = await apiClient.get<{ leaveRequests: LeaveRequest[] }>("/me/leave-requests");
  return response.data.leaveRequests;
}

export async function submitLeaveRequest(data: {
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  halfDay?: boolean;
  period?: string;
  reason?: string;
}): Promise<LeaveRequest> {
  const response = await apiClient.post<{ leaveRequest: LeaveRequest }>("/leave-requests", data);
  return response.data.leaveRequest;
}

export async function cancelLeaveRequest(id: number): Promise<void> {
  await apiClient.delete(`/leave-requests/${id}`);
}

// ─── Leave Types ──────────────────────────────────────────────────────────────

export async function getLeaveTypes(): Promise<LeaveType[]> {
  const response = await apiClient.get<{ leaveTypes: LeaveType[] }>("/leave-types");
  return response.data.leaveTypes;
}

export async function createLeaveType(data: Omit<LeaveType, "id" | "isActive">): Promise<LeaveType> {
  const response = await apiClient.post<{ leaveType: LeaveType }>("/leave-types", data);
  return response.data.leaveType;
}

export async function updateLeaveType(id: number, data: Partial<Omit<LeaveType, "id">>): Promise<LeaveType> {
  const response = await apiClient.patch<{ leaveType: LeaveType }>(`/leave-types/${id}`, data);
  return response.data.leaveType;
}

// ─── Leave Balances ───────────────────────────────────────────────────────────

export async function getLeaveBalances(): Promise<LeaveBalance[]> {
  const response = await apiClient.get<{ leaveBalances: LeaveBalance[] }>("/me/balances");
  return response.data.leaveBalances;
}

// ─── Manager Approvals ────────────────────────────────────────────────────────

export async function getPendingApprovals(): Promise<PendingRequest[]> {
  const response = await apiClient.get<{ leaveRequests: PendingRequest[] }>("/manager/leave-requests");
  return response.data.leaveRequests;
}

export async function approveLeaveRequest(id: number, comment?: string): Promise<void> {
  await apiClient.post(`/leave-requests/${id}/approve`, comment ? { comment } : {});
}

export async function rejectLeaveRequest(id: number, comment: string): Promise<void> {
  await apiClient.post(`/leave-requests/${id}/reject`, { comment });
}

export async function approveCancellation(id: number): Promise<void> {
  await apiClient.post(`/leave-requests/${id}/approve-cancellation`, {});
}

export async function rejectCancellation(id: number, comment: string): Promise<void> {
  await apiClient.post(`/leave-requests/${id}/reject-cancellation`, { comment });
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUsers(): Promise<User[]> {
  const response = await apiClient.get<{ users: User[] }>("/users");
  return response.data.users;
}

export async function updateUserIdentity(
  id: string,
  data: { team?: string; title?: string }
): Promise<User> {
  const response = await apiClient.patch<{ user: User }>(`/users/${id}/identity`, data);
  return response.data.user;
}

// ─── Leave Calendar ───────────────────────────────────────────────────────────

export interface CalendarEntry {
  id: number;
  employeeId: string;
  employeeName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: string;
}

export const getLeaveCalendar = (year: number, month: number): Promise<CalendarEntry[]> =>
  apiClient
    .get<{ leaveRequests: CalendarEntry[] }>(`/leave-calendar?year=${year}&month=${month}`)
    .then((r) => r.data.leaveRequests);

// ─── Leave Request Detail ─────────────────────────────────────────────────────

export interface LeaveRequestDetail {
  id: number;
  employeeId: string;
  employeeName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  halfDay: boolean;
  period?: string;
  totalDays: number;
  reason?: string;
  status: string;
  approvedById?: string;
  approverComment?: string;
  createdAt: string;
}

export const getLeaveRequest = (id: number): Promise<LeaveRequestDetail> =>
  apiClient.get<{ leaveRequest: LeaveRequestDetail }>(`/leave-requests/${id}`).then(r => r.data.leaveRequest);

// ─── Admin Leave Requests ─────────────────────────────────────────────────────

export interface AdminLeaveRequest {
  id: number;
  employeeId: string;
  employeeName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: string;
  reason?: string;
  approvedById?: string;
  approverComment?: string;
  createdAt: string;
}

export const getAdminLeaveRequests = (params: {
  employeeId?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ leaveRequests: AdminLeaveRequest[]; total: number; page: number; pageSize: number }> => {
  const query = new URLSearchParams();
  if (params.employeeId) query.set("employeeId", params.employeeId);
  if (params.status) query.set("status", params.status);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  return apiClient.get(`/admin/leave-requests?${query}`).then(r => r.data);
};

// ─── Admin Balances ───────────────────────────────────────────────────────────

export interface BalanceRow {
  id: number;
  userId: string;
  userName: string;
  userEmail: string;
  leaveTypeId: number;
  leaveTypeName: string;
  year: number;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
}

export const getAdminBalances = (params: { year?: number; userId?: string }): Promise<{ balances: BalanceRow[] }> => {
  const query = new URLSearchParams();
  if (params.year) query.set("year", String(params.year));
  if (params.userId) query.set("userId", params.userId);
  return apiClient.get(`/admin/balances?${query}`).then(r => r.data);
};

export const initBalances = (year: number): Promise<{ created: number; skipped: number }> =>
  apiClient.post("/admin/balances/init", { year }).then(r => r.data);

export const carryForwardBalances = (fromYear: number, toYear: number): Promise<{ carried: number; skipped: number }> =>
  apiClient.post("/admin/balances/carry-forward", { fromYear, toYear }).then(r => r.data);

export default apiClient;
