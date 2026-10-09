import { boolean, float, index, int, json, mysqlEnum, mysqlTable, primaryKey, text, timestamp, varchar, date } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  username: varchar("username", { length: 48 }).unique(),
  bio: text("bio"),
  avatarUrl: text("avatarUrl"),
  birthDate: date("birthDate", { mode: "string" }),
  language: mysqlEnum("language", ["id", "en"]).default("id").notNull(),
  theme: mysqlEnum("theme", ["light", "dark", "system"]).default("system").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const localCredentials = mysqlTable("local_credentials", {
  userId: int("userId").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 180 }).notNull(),
  passwordUpdatedAt: timestamp("passwordUpdatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const accountSessions = mysqlTable("account_sessions", {
  tokenHash: varchar("tokenHash", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("account_sessions_user_expiry_idx").on(table.userId, table.expiresAt)]);

export const poems = mysqlTable("poems", {
  id: varchar("id", { length: 36 }).primaryKey(),
  authorId: int("authorId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 180 }).notNull(),
  content: text("content").notNull(),
  status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  publishedAt: timestamp("publishedAt"),
}, table => [index("poems_author_status_idx").on(table.authorId, table.status), index("poems_published_idx").on(table.status, table.publishedAt)]);

export const likes = mysqlTable("likes", {
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  poemId: varchar("poemId", { length: 36 }).notNull().references(() => poems.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [primaryKey({ columns: [table.userId, table.poemId] }), index("likes_poem_idx").on(table.poemId)]);

export const comments = mysqlTable("comments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  poemId: varchar("poemId", { length: 36 }).notNull().references(() => poems.id, { onDelete: "cascade" }),
  authorId: int("authorId").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("comments_poem_created_idx").on(table.poemId, table.createdAt)]);

export const follows = mysqlTable("follows", {
  followerId: int("followerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  followingId: int("followingId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  primaryKey({ columns: [table.followerId, table.followingId] }),
  index("follows_following_idx").on(table.followingId),
]);

export const notifications = mysqlTable("notifications", {
  id: varchar("id", { length: 36 }).primaryKey(),
  recipientId: int("recipientId").notNull().references(() => users.id, { onDelete: "cascade" }),
  actorId: int("actorId").notNull().references(() => users.id, { onDelete: "cascade" }),
  poemId: varchar("poemId", { length: 36 }).references(() => poems.id, { onDelete: "cascade" }),
  commentId: varchar("commentId", { length: 36 }).references(() => comments.id, { onDelete: "cascade" }),
  kind: mysqlEnum("kind", ["like", "comment", "follow"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  readAt: timestamp("readAt"),
}, table => [
  index("notifications_recipient_created_idx").on(table.recipientId, table.createdAt),
  index("notifications_recipient_read_idx").on(table.recipientId, table.readAt),
]);

type FeedbackTaskStatus = "done" | "stuck" | "skipped";
export type UsabilityTaskResults = {
  draft: FeedbackTaskStatus;
  publish: FeedbackTaskStatus;
  appreciation: FeedbackTaskStatus;
  follow: FeedbackTaskStatus;
  settings: FeedbackTaskStatus;
  export: FeedbackTaskStatus;
};

export const usabilityFeedback = mysqlTable("usability_feedback", {
  id: varchar("id", { length: 36 }).primaryKey(),
  deviceType: mysqlEnum("deviceType", ["mobile", "desktop", "tablet", "other"]).notNull(),
  firstVisit: boolean("firstVisit").notNull(),
  taskResults: json("taskResults").$type<UsabilityTaskResults>().notNull(),
  sus1: int("sus1").notNull(),
  sus2: int("sus2").notNull(),
  sus3: int("sus3").notNull(),
  sus4: int("sus4").notNull(),
  sus5: int("sus5").notNull(),
  sus6: int("sus6").notNull(),
  sus7: int("sus7").notNull(),
  sus8: int("sus8").notNull(),
  sus9: int("sus9").notNull(),
  sus10: int("sus10").notNull(),
  susScore: float("susScore").notNull(),
  confusion: text("confusion"),
  suggestion: text("suggestion"),
  consentedAt: timestamp("consentedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("usability_feedback_created_idx").on(table.createdAt),
  index("usability_feedback_device_idx").on(table.deviceType),
]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Poem = typeof poems.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
