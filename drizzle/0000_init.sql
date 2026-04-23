CREATE TABLE `profiles` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `created_at` integer NOT NULL
);

CREATE TABLE `spaces` (
  `id` text PRIMARY KEY NOT NULL,
  `profile_id` text NOT NULL,
  `name` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE cascade
);

CREATE TABLE `tabs` (
  `id` text PRIMARY KEY NOT NULL,
  `space_id` text NOT NULL,
  `url` text NOT NULL,
  `title` text NOT NULL,
  `pinned` integer DEFAULT 0 NOT NULL,
  `position` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON DELETE cascade
);

CREATE TABLE `settings` (
  `key` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE TABLE `bookmarks` (
  `id` text PRIMARY KEY NOT NULL,
  `url` text NOT NULL,
  `title` text NOT NULL,
  `created_at` integer NOT NULL
);

CREATE TABLE `history` (
  `id` text PRIMARY KEY NOT NULL,
  `url` text NOT NULL,
  `title` text NOT NULL,
  `visited_at` integer NOT NULL
);
