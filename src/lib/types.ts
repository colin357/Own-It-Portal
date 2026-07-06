import type { Timestamp } from "firebase/firestore";

export type Role = "admin" | "client";

export type ClientStatus = "onboarding" | "active" | "archived";

export interface Client {
  id: string;
  name: string;
  status: ClientStatus;
  tagIds: string[];
  ownerUid: string;
  notes: string;
  phone?: string | null;
  lastTaskReminderAt?: Timestamp | null;
  createdAt: Timestamp;
}

export interface PortalUser {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  clientId: string | null;
  isOwner: boolean;
  createdAt: Timestamp;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export type TaskStatus = "todo" | "in_progress" | "waiting_on_client" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type VideoProvider = "loom" | "gdrive" | "youtube" | "other";

export interface Attachment {
  path: string;
  name: string;
  contentType: string;
  size: number;
  downloadURL: string;
}

export interface Task {
  id: string;
  clientId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Timestamp | null;
  videoUrl: string | null;
  attachments: Attachment[];
  createdBy: { uid: string; role: Role };
  assignedTo: "client" | "admin";
  templateId: string | null;
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt: Timestamp | null;
}

export interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  videoUrl: string | null;
  dueOffsetDays: number;
  order: number;
  active: boolean;
}

export type ContentType = "idea" | "email_blast" | "blog_post" | "social_post";
export type ContentStatus = "idea" | "draft" | "scheduled" | "published";

export interface ContentItem {
  id: string;
  clientId: string;
  type: ContentType;
  title: string;
  body: string;
  status: ContentStatus;
  scheduledDate: Timestamp | null;
  link: string | null;
  attachments: Attachment[];
  createdBy: { uid: string; role: Role };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type InviteStatus = "pending" | "accepted" | "revoked";

export interface Invite {
  id: string;
  clientId: string;
  email: string;
  invitedBy: string;
  status: InviteStatus;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  waiting_on_client: "Waiting on Client",
  done: "Done",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  idea: "Content Idea",
  email_blast: "Email Blast",
  blog_post: "Blog Post",
  social_post: "Social Post",
};

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  idea: "Idea",
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
};
