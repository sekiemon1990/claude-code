import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

export type PeriodPreset = '1w' | '1m' | '3m' | 'current_month' | 'custom';

export type PeriodRange = {
  /** 期間の開始（含む） */
  from: Date;
  /** 期間の終了（含む。指定なしなら現在時刻） */
  to: Date;
  /** 表示用ラベル */
  label: string;
  preset: PeriodPreset;
};

/**
 * プリセットから {from, to, label} を計算。
 */
export function presetToRange(preset: PeriodPreset): PeriodRange | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  switch (preset) {
    case '1w': {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      return { from, to: today, label: '直近1週間', preset };
    }
    case '1m': {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      from.setHours(0, 0, 0, 0);
      return { from, to: today, label: '直近1ヶ月', preset };
    }
    case '3m': {
      const from = new Date(today);
      from.setDate(from.getDate() - 89);
      from.setHours(0, 0, 0, 0);
      return { from, to: today, label: '直近3ヶ月', preset };
    }
    case 'current_month': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return {
        from,
        to: today,
        label: `当月（${format(now, 'M月', { locale: ja })}）`,
        preset,
      };
    }
    case 'custom':
      return null;
  }
}

type Props = {
  value: PeriodRange;
  onChange: (range: PeriodRange) => void;
};

const PRESETS: Array<{ key: PeriodPreset; label: string }> = [
  { key: '1w', label: '1週間' },
  { key: '1m', label: '1ヶ月' },
  { key: '3m', label: '3ヶ月' },
  { key: 'current_month', label: '当月' },
  { key: 'custom', label: '期間指定' },
];

function parseDateInput(text: string): Date | null {
  const m = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  const date = new Date(y, mo, d);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function PeriodSelector({ value, onChange }: Props) {
  const [customFromText, setCustomFromText] = useState(format(value.from, 'yyyy-MM-dd'));
  const [customToText, setCustomToText] = useState(format(value.to, 'yyyy-MM-dd'));
  const [customError, setCustomError] = useState<string | null>(null);

  function handlePresetTap(preset: PeriodPreset) {
    if (preset === 'custom') {
      // 切替時、現在の値を初期値にしてフォームを開く
      const range: PeriodRange = {
        from: value.from,
        to: value.to,
        label: '期間指定',
        preset: 'custom',
      };
      onChange(range);
      return;
    }
    const range = presetToRange(preset);
    if (range) onChange(range);
  }

  function handleApplyCustom() {
    const from = parseDateInput(customFromText);
    const to = parseDateInput(customToText);
    if (!from || !to) {
      setCustomError('YYYY-MM-DD 形式で入力してください');
      return;
    }
    if (from.getTime() > to.getTime()) {
      setCustomError('開始日は終了日以前にしてください');
      return;
    }
    setCustomError(null);
    // to は終わりの23:59に
    const toEnd = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);
    onChange({
      from,
      to: toEnd,
      label: `${format(from, 'M/d', { locale: ja })} 〜 ${format(to, 'M/d', {
        locale: ja,
      })}`,
      preset: 'custom',
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.chips}>
        {PRESETS.map((p) => {
          const active = value.preset === p.key;
          return (
            <Pressable
              key={p.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => handlePresetTap(p.key)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {value.preset === 'custom' ? (
        <View style={styles.customBox}>
          <View style={styles.customInputs}>
            <TextInput
              style={styles.input}
              placeholder="2026-01-01"
              value={customFromText}
              onChangeText={setCustomFromText}
              autoCapitalize="none"
            />
            <Text style={styles.tilde}>〜</Text>
            <TextInput
              style={styles.input}
              placeholder="2026-12-31"
              value={customToText}
              onChangeText={setCustomToText}
              autoCapitalize="none"
            />
            <Pressable style={styles.applyBtn} onPress={handleApplyCustom}>
              <Text style={styles.applyBtnText}>適用</Text>
            </Pressable>
          </View>
          {customError ? <Text style={styles.errorText}>{customError}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  chipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  customBox: { marginTop: 6 },
  customInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0F172A',
    backgroundColor: '#fff',
    minWidth: 100,
  },
  tilde: { color: '#64748B', fontSize: 12 },
  applyBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  applyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  errorText: { color: '#DC2626', fontSize: 11, marginTop: 4 },
});
