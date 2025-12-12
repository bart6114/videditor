CREATE TYPE "public"."inbox_message_type" AS ENUM('error', 'info', 'announcement');--> statement-breakpoint
CREATE TABLE "inbox_messages" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"type" "inbox_message_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"action_url" varchar(2048),
	"action_label" varchar(100),
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_inbox_messages_user_id" ON "inbox_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_inbox_messages_user_unread" ON "inbox_messages" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "idx_inbox_messages_created_at" ON "inbox_messages" USING btree ("created_at");