'use client';

import { useCallback, useEffect, useState } from 'react';

import { getToken, useToast } from '@/lib/admin-utils';

import AutomationSection from './components/AutomationSection';
import ConfigSectionsList from './components/ConfigSectionsList';
import EditConfigModal from './components/EditConfigModal';
import ModelConfigSection from './components/ModelConfigSection';
import {
  AUTO_RESPOND_IDS_KEY,
  AUTO_SYNC_KEY,
  LineUserInfo,
  MODEL_DEFAULTS,
  MODEL_FIELDS,
} from './constants';

export default function SettingsPage() {
  const [configs, setConfigs] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [allUsers, setAllUsers] = useState<LineUserInfo[]>([]);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const { toast } = useToast();

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/config', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { key: string; value: string }[];
        const map = new Map<string, string>();
        for (const item of data) {
          map.set(item.key, item.value);
        }
        setConfigs(map);
      }
    } catch {
      toast('無法載入設定，請重新整理頁面', 'error');
    }
    setLoading(false);
  }, [toast]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setAllUsers((await res.json()) as LineUserInfo[]);
    } catch {
      toast('無法載入用戶清單', 'error');
    }
  }, [toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchConfigs();
    void fetchUsers();
  }, [fetchConfigs, fetchUsers]);

  function getAdminIds(): string[] {
    return (configs.get(AUTO_RESPOND_IDS_KEY) || '')
      .split(/[\n,]/)
      .map((id) => id.trim())
      .filter(Boolean);
  }

  async function saveAdminIds(ids: string[]) {
    try {
      const value = ids.join('\n');
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ key: AUTO_RESPOND_IDS_KEY, value }),
      });
      if (res.ok) {
        setConfigs((prev) => {
          const m = new Map(prev);
          m.set(AUTO_RESPOND_IDS_KEY, value);
          return m;
        });
        toast('管理員名單已更新！');
      }
    } catch {
      toast('更新管理員名單失敗', 'error');
    }
  }

  async function selectModel(key: string, value: string) {
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ key, value }),
      });
      const label = MODEL_FIELDS.find((f) => f.key === key)?.label || key;
      if (res.ok) {
        setConfigs((prev) => {
          const m = new Map(prev);
          m.set(key, value);
          return m;
        });
        toast(`${label} 已切換為 ${value.replace('gemini-', '')}`);
      }
    } catch {
      const label = MODEL_FIELDS.find((f) => f.key === key)?.label || key;
      toast(`切換 ${label} 失敗`, 'error');
    }
  }

  async function resetModels() {
    if (!confirm('確定要恢復所有模型為預設設定嗎？')) return;
    try {
      await Promise.all(
        Object.entries(MODEL_DEFAULTS).map(([key, value]) =>
          fetch('/api/admin/config', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${getToken()}`,
            },
            body: JSON.stringify({ key, value }),
          }),
        ),
      );
      setConfigs((prev) => {
        const m = new Map(prev);
        for (const [key, value] of Object.entries(MODEL_DEFAULTS)) {
          m.set(key, value);
        }
        return m;
      });
      toast('已恢復所有模型為預設設定');
    } catch {
      toast('恢復預設失敗', 'error');
    }
  }

  async function toggleAutoSync() {
    try {
      const current = configs.get(AUTO_SYNC_KEY);
      const next = current === 'false' ? 'true' : 'false';
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ key: AUTO_SYNC_KEY, value: next }),
      });
      if (res.ok) {
        setConfigs((prev) => {
          const m = new Map(prev);
          m.set(AUTO_SYNC_KEY, next);
          return m;
        });
      }
    } catch {
      toast('切換自動同步失敗', 'error');
    }
  }

  function startEdit(key: string) {
    setEditingKey(key);
    setEditValue(configs.get(key) || '');
  }

  async function handleSave() {
    if (!editingKey) return;
    setSaving(true);

    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ key: editingKey, value: editValue }),
      });

      const result = (await res.json()) as { warnings?: string[]; error?: string };
      if (res.ok) {
        setConfigs((prev) => {
          const next = new Map(prev);
          next.set(editingKey, editValue);
          return next;
        });
        if (result.warnings && result.warnings.length > 0) {
          toast('儲存成功！⚠️ ' + result.warnings.join(', '));
        } else {
          toast('儲存成功！即時生效中');
        }
        setEditingKey(null);
      } else {
        toast(result.error || '儲存失敗', 'error');
      }
    } catch {
      toast('網路錯誤', 'error');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 rounded-full border-2 border-amber-800 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-[17px] font-semibold text-stone-800">系統設定</h1>

      <ModelConfigSection
        configs={configs}
        onSelectModel={selectModel}
        onResetModels={resetModels}
      />

      <AutomationSection
        configs={configs}
        allUsers={allUsers}
        adminIds={getAdminIds()}
        showAddAdmin={showAddAdmin}
        setShowAddAdmin={setShowAddAdmin}
        onToggleAutoSync={toggleAutoSync}
        saveAdminIds={saveAdminIds}
      />

      <ConfigSectionsList configs={configs} startEdit={startEdit} />

      {editingKey && (
        <EditConfigModal
          editingKey={editingKey}
          editValue={editValue}
          setEditValue={setEditValue}
          saving={saving}
          onClose={() => setEditingKey(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
