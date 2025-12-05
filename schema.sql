


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."credit_tx_category" AS ENUM (
    'subscription',
    'topup',
    'bonus',
    'usage',
    'ad_reward',
    'normal',
    'chat_spend',
    'fashion_spend'
);


ALTER TYPE "public"."credit_tx_category" OWNER TO "postgres";


CREATE TYPE "public"."credit_tx_type" AS ENUM (
    'usage',
    'earn',
    'charge',
    'reset',
    'adjustment'
);


ALTER TYPE "public"."credit_tx_type" OWNER TO "postgres";


CREATE TYPE "public"."payment_provider" AS ENUM (
    'stripe',
    'toss',
    'paypal'
);


ALTER TYPE "public"."payment_provider" OWNER TO "postgres";


CREATE TYPE "public"."plan_interval" AS ENUM (
    'month',
    'year'
);


ALTER TYPE "public"."plan_interval" OWNER TO "postgres";


CREATE TYPE "public"."refn_mode" AS ENUM (
    'search',
    'generate'
);


ALTER TYPE "public"."refn_mode" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."use_credits"("p_amount" integer, "p_service_code" "text", "p_category" "text" DEFAULT 'normal'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();  -- Supabase auth 사용자
  v_balance int;
begin
  if v_user_id is null then
    raise exception 'unauthorized';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  -- 현재 잔액 조회 (없으면 0으로 취급)
  select coalesce(balance, 0) into v_balance
  from credit_wallets
  where user_id = v_user_id
  for update;

  if not found then
    v_balance := 0;
    insert into credit_wallets (user_id, balance, lifetime_used, updated_at)
    values (v_user_id, 0, 0, now());
  end if;

  if v_balance < p_amount then
    raise exception 'insufficient_credits';
  end if;

  -- 거래 기록
  insert into credit_transactions (
    user_id, subscription_id, tx_type, category, service_code,
    amount, balance_after, description, created_at
  ) values (
    v_user_id, null, 'usage', p_category, p_service_code,
    -p_amount, v_balance - p_amount, p_service_code || ' usage', now()
  );

  -- 지갑 차감
  update credit_wallets
    set balance = balance - p_amount,
        lifetime_used = coalesce(lifetime_used,0) + p_amount,
        updated_at = now()
  where user_id = v_user_id;
end;
$$;


ALTER FUNCTION "public"."use_credits"("p_amount" integer, "p_service_code" "text", "p_category" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ad_sessions" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "ad_network" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "used" boolean DEFAULT false,
    "used_at" timestamp with time zone,
    "verification" "jsonb"
);


ALTER TABLE "public"."ad_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."character_chats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "character_id" "uuid",
    "session_id" "uuid",
    "user_id" "uuid",
    "role" "text",
    "content" "text",
    "model" "text",
    "input_tokens" integer,
    "output_tokens" integer,
    "credit_spent" numeric,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."character_chats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."character_memories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "character_id" "uuid",
    "memory_type" "text",
    "content" "text",
    "importance" integer,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."character_memories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."character_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "character_id" "uuid",
    "summary" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."character_summaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."characters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid",
    "name" "text" NOT NULL,
    "one_line" "text",
    "intro" "text",
    "play_guide" "text",
    "prompt" "text",
    "description" "text",
    "genre" "text",
    "target" "text",
    "tags" "text"[],
    "visibility" "text" DEFAULT 'public'::"text",
    "is_monetized" boolean DEFAULT false,
    "comment_enabled" boolean DEFAULT true,
    "avatar_url" "text",
    "voice_url" "text",
    "media_urls" "text"[],
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "like_count" bigint DEFAULT 0,
    "view_count" bigint DEFAULT 0,
    "example_dialog" "text",
    "gallery_image_urls" "text"[],
    "intro_image_url" "text",
    "thumbnail_image_url" "text",
    "example_dialog_pairs" "jsonb",
    "scene_image_templates" "jsonb",
    CONSTRAINT "characters_description_len" CHECK (("char_length"("description") <= 1000)),
    CONSTRAINT "characters_example_dialog_len" CHECK ((COALESCE("char_length"("example_dialog"), 0) <= 6000)),
    CONSTRAINT "characters_gallery_image_limit" CHECK (("array_length"("gallery_image_urls", 1) <= 5)),
    CONSTRAINT "characters_intro_len" CHECK (("char_length"("intro") <= 1500)),
    CONSTRAINT "characters_name_len" CHECK ((("char_length"("name") >= 2) AND ("char_length"("name") <= 12))),
    CONSTRAINT "characters_one_line_len" CHECK (("char_length"("one_line") <= 30)),
    CONSTRAINT "characters_prompt_len" CHECK (("char_length"("prompt") <= 2000))
);


ALTER TABLE "public"."characters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_transactions" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subscription_id" "uuid",
    "tx_type" "public"."credit_tx_type" NOT NULL,
    "category" "public"."credit_tx_category",
    "service_code" "text",
    "amount" integer NOT NULL,
    "balance_after" integer,
    "description" "text",
    "metadata" "jsonb",
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."credit_transactions" OWNER TO "postgres";


ALTER TABLE "public"."credit_transactions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."credit_transactions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."credit_wallets" (
    "user_id" "uuid" NOT NULL,
    "balance" integer DEFAULT 0 NOT NULL,
    "lifetime_used" integer DEFAULT 0 NOT NULL,
    "last_reset_at" timestamp with time zone,
    "next_reset_at" timestamp with time zone,
    "locked" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."credit_wallets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_orders" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subscription_id" "uuid",
    "order_type" "text" NOT NULL,
    "plan_id" "uuid",
    "credits" integer DEFAULT 0 NOT NULL,
    "price_cents" integer NOT NULL,
    "currency" "text" DEFAULT 'KRW'::"text" NOT NULL,
    "provider" "public"."payment_provider" DEFAULT 'stripe'::"public"."payment_provider" NOT NULL,
    "provider_session_id" "text",
    "provider_payment_intent_id" "text",
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_orders_order_type_check" CHECK (("order_type" = ANY (ARRAY['subscription'::"text", 'addon'::"text", 'one_time'::"text"]))),
    CONSTRAINT "payment_orders_status_check" CHECK (("status" = ANY (ARRAY['requires_payment'::"text", 'paid'::"text", 'failed'::"text", 'canceled'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."payment_orders" OWNER TO "postgres";


ALTER TABLE "public"."payment_orders" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."payment_orders_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price_cents" integer DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'KRW'::"text" NOT NULL,
    "billing_interval" "public"."plan_interval" DEFAULT 'month'::"public"."plan_interval" NOT NULL,
    "reset_credits" integer NOT NULL,
    "reset_interval_hours" integer NOT NULL,
    "max_credits" integer,
    "is_trial" boolean DEFAULT false NOT NULL,
    "trial_days" integer,
    "features" "jsonb",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "handle" "text",
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "current_plan_id" "uuid",
    "current_credits" integer DEFAULT 0 NOT NULL,
    "bio" "text",
    "website" "text",
    "job" "text",
    "gender" "text",
    "age_range" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refn_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "thumbnail_url" "text",
    "width" integer,
    "height" integer,
    "provider" "text",
    "seed" bigint,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."refn_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refn_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "service_code" "text" NOT NULL,
    "mode" "public"."refn_mode" NOT NULL,
    "prompt" "text" NOT NULL,
    "keyword_tags" "text"[] DEFAULT '{}'::"text"[],
    "reference_count" integer DEFAULT 0 NOT NULL,
    "selected_reference_ids" "text"[] DEFAULT '{}'::"text"[],
    "used_credits" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'searching'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "refn_sessions_status_check" CHECK (("status" = ANY (ARRAY['searching'::"text", 'generating'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."refn_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "is_primary" boolean DEFAULT true NOT NULL,
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false NOT NULL,
    "provider" "public"."payment_provider" DEFAULT 'stripe'::"public"."payment_provider" NOT NULL,
    "provider_customer_id" "text",
    "provider_subscription_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'trialing'::"text", 'canceled'::"text", 'past_due'::"text", 'incomplete'::"text"])))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_contents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "service_code" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "title" "text",
    "prompt" "text",
    "keywords" "text",
    "thumb_url" "text",
    "full_url" "text",
    "extra" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "user_contents_kind_check" CHECK (("kind" = ANY (ARRAY['image'::"text", 'chat'::"text", 'video'::"text", 'audio'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."user_contents" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ad_sessions"
    ADD CONSTRAINT "ad_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."character_chats"
    ADD CONSTRAINT "character_chats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."character_memories"
    ADD CONSTRAINT "character_memories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."character_summaries"
    ADD CONSTRAINT "character_summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."characters"
    ADD CONSTRAINT "characters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_wallets"
    ADD CONSTRAINT "credit_wallets_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_handle_key" UNIQUE ("handle");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."refn_images"
    ADD CONSTRAINT "refn_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."refn_sessions"
    ADD CONSTRAINT "refn_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_contents"
    ADD CONSTRAINT "user_contents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."character_chats"
    ADD CONSTRAINT "character_chats_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id");



ALTER TABLE ONLY "public"."character_memories"
    ADD CONSTRAINT "character_memories_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id");



ALTER TABLE ONLY "public"."character_summaries"
    ADD CONSTRAINT "character_summaries_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id");



ALTER TABLE ONLY "public"."characters"
    ADD CONSTRAINT "characters_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id");



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."credit_wallets"
    ADD CONSTRAINT "credit_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id");



ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id");



ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_current_plan_id_fkey" FOREIGN KEY ("current_plan_id") REFERENCES "public"."plans"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."refn_images"
    ADD CONSTRAINT "refn_images_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."refn_sessions"("id");



ALTER TABLE ONLY "public"."refn_sessions"
    ADD CONSTRAINT "refn_sessions_service_code_fkey" FOREIGN KEY ("service_code") REFERENCES "public"."services"("code");



ALTER TABLE ONLY "public"."refn_sessions"
    ADD CONSTRAINT "refn_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_contents"
    ADD CONSTRAINT "user_contents_service_code_fkey" FOREIGN KEY ("service_code") REFERENCES "public"."services"("code");



ALTER TABLE ONLY "public"."user_contents"
    ADD CONSTRAINT "user_contents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."use_credits"("p_amount" integer, "p_service_code" "text", "p_category" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."use_credits"("p_amount" integer, "p_service_code" "text", "p_category" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."use_credits"("p_amount" integer, "p_service_code" "text", "p_category" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."ad_sessions" TO "anon";
GRANT ALL ON TABLE "public"."ad_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."ad_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."character_chats" TO "anon";
GRANT ALL ON TABLE "public"."character_chats" TO "authenticated";
GRANT ALL ON TABLE "public"."character_chats" TO "service_role";



GRANT ALL ON TABLE "public"."character_memories" TO "anon";
GRANT ALL ON TABLE "public"."character_memories" TO "authenticated";
GRANT ALL ON TABLE "public"."character_memories" TO "service_role";



GRANT ALL ON TABLE "public"."character_summaries" TO "anon";
GRANT ALL ON TABLE "public"."character_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."character_summaries" TO "service_role";



GRANT ALL ON TABLE "public"."characters" TO "anon";
GRANT ALL ON TABLE "public"."characters" TO "authenticated";
GRANT ALL ON TABLE "public"."characters" TO "service_role";



GRANT ALL ON TABLE "public"."credit_transactions" TO "anon";
GRANT ALL ON TABLE "public"."credit_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_transactions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."credit_transactions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."credit_transactions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."credit_transactions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."credit_wallets" TO "anon";
GRANT ALL ON TABLE "public"."credit_wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_wallets" TO "service_role";



GRANT ALL ON TABLE "public"."payment_orders" TO "anon";
GRANT ALL ON TABLE "public"."payment_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_orders" TO "service_role";



GRANT ALL ON SEQUENCE "public"."payment_orders_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."payment_orders_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."payment_orders_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."plans" TO "anon";
GRANT ALL ON TABLE "public"."plans" TO "authenticated";
GRANT ALL ON TABLE "public"."plans" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."refn_images" TO "anon";
GRANT ALL ON TABLE "public"."refn_images" TO "authenticated";
GRANT ALL ON TABLE "public"."refn_images" TO "service_role";



GRANT ALL ON TABLE "public"."refn_sessions" TO "anon";
GRANT ALL ON TABLE "public"."refn_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."refn_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."user_contents" TO "anon";
GRANT ALL ON TABLE "public"."user_contents" TO "authenticated";
GRANT ALL ON TABLE "public"."user_contents" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































