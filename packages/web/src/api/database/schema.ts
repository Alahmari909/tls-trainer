import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// Users (legacy — keep for FK refs)
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("student"),
  avatarUrl: text("avatar_url"),
  createdAt: integer("created_at").notNull().default(0),
});

// Profiles
export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  rank: text("rank"),
  unit: text("unit"),
  bio: text("bio"),
  phone: text("phone"),
  location: text("location"),
  updatedAt: integer("updated_at").notNull().default(0),
});

// Trainees — lightweight trainee identity (created on registration)
export const trainees = sqliteTable("trainees", {
  id: text("id").primaryKey(),          // uuid
  name: text("name").notNull(),
  rank: text("rank"),
  unit: text("unit"),
  pin: text("pin"),                     // 4-digit PIN for login (optional)
  createdAt: integer("created_at").notNull().default(0),
  lastLoginAt: integer("last_login_at").default(0),
  loginCount: integer("login_count").notNull().default(0),
  isOnline: integer("is_online").notNull().default(0),
  lastPage: text("last_page").default("/"),
  lastActiveAt: integer("last_active_at").default(0),
});

// Activity log — every meaningful event per trainee
export const activityLog = sqliteTable("activity_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  traineeId: text("trainee_id").notNull(),
  event: text("event").notNull(),       // login|logout|module_open|quiz_start|quiz_finish|manual_view|page_view|etc
  detail: text("detail"),              // JSON string with extra data
  page: text("page"),
  ts: integer("ts").notNull(),
});

// Quiz attempts — individual attempt records
export const quizAttempts = sqliteTable("quiz_attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  traineeId: text("trainee_id").notNull(),
  moduleId: integer("module_id").notNull(),
  moduleName: text("module_name"),
  score: integer("score").notNull().default(0),
  total: integer("total").notNull().default(0),
  correct: integer("correct").notNull().default(0),
  wrong: integer("wrong").notNull().default(0),
  pct: real("pct").notNull().default(0),
  passed: integer("passed").notNull().default(0),
  ts: integer("ts").notNull(),
});

// Instructor notes — admin notes on a trainee
export const instructorNotes = sqliteTable("instructor_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  traineeId: text("trainee_id").notNull(),
  note: text("note").notNull(),
  authorId: text("author_id").notNull().default("admin"),
  ts: integer("ts").notNull(),
});

// Trainee messages (admin ↔ trainee private messages)
export const traineeMessages = sqliteTable("trainee_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  traineeId: text("trainee_id").notNull(),
  senderRole: text("sender_role").notNull().default("admin"), // admin | trainee
  text: text("text").notNull(),
  read: integer("read").notNull().default(0),
  ts: integer("ts").notNull(),
});

// Admin alerts sent to trainees
export const traineeAlerts = sqliteTable("trainee_alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  traineeId: text("trainee_id").notNull(),
  message: text("message").notNull(),
  alertType: text("alert_type").notNull().default("info"), // info|warning|danger
  read: integer("read").notNull().default(0),
  ts: integer("ts").notNull(),
});

// Modules
export const modules = sqliteTable("modules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  description: text("description"),
  icon: text("icon").default("📡"),
  color: text("color").default("#1e90ff"),
  order: integer("order").notNull().default(0),
  lessonCount: integer("lesson_count").notNull().default(0),
  isPublished: integer("is_published").notNull().default(1),
});

// Questions (quiz questions per module)
export const questions = sqliteTable("questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  moduleId: integer("module_id").notNull().references(() => modules.id),
  question: text("question").notNull(),
  optionA: text("option_a").notNull(),
  optionB: text("option_b").notNull(),
  optionC: text("option_c").notNull(),
  optionD: text("option_d").notNull(),
  correctOption: text("correct_option").notNull(),
  explanation: text("explanation"),
  order: integer("order").notNull().default(0),
});

// Module Progress per user
export const moduleProgress = sqliteTable("module_progress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id),
  moduleId: integer("module_id").notNull().references(() => modules.id),
  progress: real("progress").notNull().default(0),
  completed: integer("completed").notNull().default(0),
  lastAccessedAt: integer("last_accessed_at").notNull().default(0),
});

// Trainee module progress (separate from legacy user progress)
export const traineeModuleProgress = sqliteTable("trainee_module_progress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  traineeId: text("trainee_id").notNull(),
  moduleId: integer("module_id").notNull(),
  moduleName: text("module_name"),
  progress: real("progress").notNull().default(0),
  completed: integer("completed").notNull().default(0),
  assignedByAdmin: integer("assigned_by_admin").notNull().default(0),
  lastAccessedAt: integer("last_accessed_at").notNull().default(0),
});

// Streaks
export const streaks = sqliteTable("streaks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActivityDate: text("last_activity_date"),
  totalXp: integer("total_xp").notNull().default(0),
});

// Achievements / Badges
export const achievements = sqliteTable("achievements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon").default("🏅"),
  color: text("color").default("#ffaa00"),
  xpReward: integer("xp_reward").notNull().default(50),
});

// User Achievements (earned)
export const userAchievements = sqliteTable("user_achievements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id),
  achievementId: integer("achievement_id").notNull().references(() => achievements.id),
  earnedAt: integer("earned_at").notNull().default(0),
});

// Sessions
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull().default(0),
});

// Chat Messages (legacy)
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id),
  senderRole: text("sender_role").notNull().default("student"),
  text: text("text").notNull(),
  createdAt: integer("created_at").notNull().default(0),
});

// Quiz Answer Tracking — stores each question's answer per attempt
export const quizAnswers = sqliteTable("quiz_answers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  attemptId: integer("attempt_id").notNull(),   // FK to quiz_attempts.id
  traineeId: text("trainee_id").notNull(),
  moduleId: integer("module_id").notNull(),
  questionId: integer("question_id").notNull(),
  questionText: text("question_text").notNull(),
  selectedOption: text("selected_option").notNull(), // a, b, c, d
  correctOption: text("correct_option").notNull(),
  isCorrect: integer("is_correct").notNull().default(0),
  ts: integer("ts").notNull(),
});
