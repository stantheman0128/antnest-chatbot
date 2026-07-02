import Image from 'next/image';

import { AUTO_SYNC_KEY, LineUserInfo } from '../constants';

interface AutomationSectionProps {
  configs: Map<string, string>;
  allUsers: LineUserInfo[];
  adminIds: string[];
  showAddAdmin: boolean;
  setShowAddAdmin: (v: boolean) => void;
  onToggleAutoSync: () => void;
  saveAdminIds: (ids: string[]) => void;
}

export default function AutomationSection({
  configs,
  allUsers,
  adminIds,
  showAddAdmin,
  setShowAddAdmin,
  onToggleAutoSync,
  saveAdminIds,
}: AutomationSectionProps) {
  const autoSyncOn = configs.get(AUTO_SYNC_KEY) !== 'false';

  return (
    <div>
      <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-3">
        自動化
      </p>
      <div className="bg-white rounded-2xl border border-stone-100 px-4 py-3.5 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium text-stone-800">產品自動同步</p>
          <p className="text-[11px] text-stone-400 mt-0.5">每週一 20:05（台灣時間）自動同步官網</p>
        </div>
        <button
          onClick={onToggleAutoSync}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            autoSyncOn ? 'bg-amber-700' : 'bg-stone-200'
          }`}
          role="switch"
          aria-checked={autoSyncOn}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              autoSyncOn ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Admin / always-respond users */}
      <div className="bg-white rounded-2xl border border-stone-100 px-4 py-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-stone-800">管理員身份</p>
            <p className="text-[11px] text-stone-400 mt-0.5">
              這些人傳訊息時，小螞蟻會自動回覆（不需要呼叫小螞蟻）
            </p>
          </div>
          <button
            onClick={() => setShowAddAdmin(true)}
            className="px-2.5 py-1 bg-amber-800 text-white rounded-lg text-[11px] font-medium hover:bg-amber-900 transition-colors shrink-0"
          >
            + 新增
          </button>
        </div>

        {/* Current admins */}
        <div className="space-y-2">
          {adminIds.length === 0 ? (
            <p className="text-[11px] text-stone-400 py-2">尚未設定管理員</p>
          ) : (
            adminIds.map((id) => {
              const user = allUsers.find((u) => u.lineUserId === id);
              return (
                <div
                  key={id}
                  className="flex items-center gap-3 bg-stone-50 rounded-xl px-3 py-2.5"
                >
                  {user?.pictureUrl ? (
                    <Image
                      src={user.pictureUrl}
                      alt={user.displayName + ' 的大頭貼'}
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded-full shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-[11px] text-stone-400 shrink-0">
                      👤
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-stone-800 truncate">
                      {user?.displayName || '未知用戶'}
                    </p>
                    <p className="text-[10px] text-stone-400 font-mono truncate">{id}</p>
                  </div>
                  <button
                    onClick={() => void saveAdminIds(adminIds.filter((x) => x !== id))}
                    className="text-[11px] text-red-400 hover:text-red-600 shrink-0"
                  >
                    移除
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Add admin modal */}
        {showAddAdmin && (
          <div className="border border-stone-200 rounded-xl p-3 space-y-2 bg-stone-50">
            <p className="text-[11px] font-semibold text-stone-500">選擇用戶或輸入 ID</p>
            {/* Known users not yet admin */}
            {allUsers.filter((u) => !adminIds.includes(u.lineUserId)).length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {allUsers
                  .filter((u) => !adminIds.includes(u.lineUserId))
                  .map((user) => (
                    <button
                      key={user.lineUserId}
                      onClick={() => {
                        void saveAdminIds([...adminIds, user.lineUserId]);
                        setShowAddAdmin(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white transition-colors text-left"
                    >
                      {user.pictureUrl ? (
                        <Image
                          src={user.pictureUrl}
                          alt={user.displayName + ' 的大頭貼'}
                          width={28}
                          height={28}
                          className="w-7 h-7 rounded-full shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center text-[10px] text-stone-400 shrink-0">
                          👤
                        </div>
                      )}
                      <span className="text-[11px] text-stone-700 truncate">
                        {user.displayName}
                      </span>
                    </button>
                  ))}
              </div>
            )}
            {/* Manual ID input */}
            <div className="flex gap-2">
              <input
                id="manual-admin-id"
                type="text"
                placeholder="或手動輸入 LINE User ID"
                className="flex-1 px-2.5 py-1.5 border border-stone-200 rounded-lg text-[11px] font-mono bg-white focus:outline-none focus:ring-2 focus:ring-amber-800/15"
              />
              <button
                onClick={() => {
                  const input = document.getElementById('manual-admin-id') as HTMLInputElement;
                  const val = input?.value?.trim();
                  if (val && !adminIds.includes(val)) {
                    void saveAdminIds([...adminIds, val]);
                    setShowAddAdmin(false);
                  }
                }}
                className="px-2.5 py-1.5 bg-amber-800 text-white rounded-lg text-[11px] font-medium hover:bg-amber-900 transition-colors shrink-0"
              >
                加入
              </button>
            </div>
            <button
              onClick={() => setShowAddAdmin(false)}
              className="text-[11px] text-stone-400 hover:text-stone-600"
            >
              取消
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
