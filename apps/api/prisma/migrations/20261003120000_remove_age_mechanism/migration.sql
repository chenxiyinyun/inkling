-- 产品决策（2026-10-03）：彻底移除年龄机制。
-- 注册不再采集出生日期；移除 user.ageTier / user.birthDate / user_profile.guardianMode
-- 与监护人同意链路（parental_consents 表 + ConsentStatus 枚举）。

-- DropTable
DROP TABLE "parental_consents";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "ageTier",
DROP COLUMN "birthDate";

-- AlterTable
ALTER TABLE "user_profiles" DROP COLUMN "guardianMode";

-- DropEnum
DROP TYPE "ConsentStatus";

-- DropEnum
DROP TYPE "AgeTier";
