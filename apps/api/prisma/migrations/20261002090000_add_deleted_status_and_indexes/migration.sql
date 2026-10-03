-- GDPR 注销状态 + 巡检/高频查询缺失索引（additive；与 schema.prisma 的 UserStatus.DELETED / @@index 保持一致）

-- AlterEnum（PG12+ 允许在事务内 ADD VALUE，新值需提交后方可使用）
ALTER TYPE "UserStatus" ADD VALUE 'DELETED';

-- CreateIndex（漂流归档巡检：status IN (FLOATING,DIMMED) AND expireAt <= now）
CREATE INDEX "letters_status_expireAt_idx" ON "letters"("status", "expireAt");

-- CreateIndex（20s 预览锁回收巡检：released=false AND lockUntil<=now）
CREATE INDEX "fishing_records_released_lockUntil_idx" ON "fishing_records"("released", "lockUntil");

-- CreateIndex（20s 笔友送达巡检：deliveredAt IS NULL AND deliverAt<=now）
CREATE INDEX "correspondences_deliveredAt_deliverAt_idx" ON "correspondences"("deliveredAt", "deliverAt");

-- CreateIndex（笔友列表 OR 查询的 userBId 分支）
CREATE INDEX "pen_pal_relations_userBId_idx" ON "pen_pal_relations"("userBId");

-- CreateIndex（GDPR 导出/举报查询 reporterId）
CREATE INDEX "reports_reporterId_idx" ON "reports"("reporterId");

-- CreateIndex（双向拉黑查询的 targetUserId 分支）
CREATE INDEX "blocks_targetUserId_idx" ON "blocks"("targetUserId");
