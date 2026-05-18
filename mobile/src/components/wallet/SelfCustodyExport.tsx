/**
 * Self-custody private key export (mobile).
 *
 * Biometric gate on "Reveal" (expo-local-authentication). Key copy uses
 * expo-clipboard + haptic feedback. Flow stages mirror the web
 * component: warn → auth → reveal → done.
 */
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { cryptoWalletAPI, type CryptoChain } from '@/lib/cryptoApi';

type Stage = 'warn' | 'auth' | 'reveal' | 'done';
const CHAINS: CryptoChain[] = ['ETH', 'BTC', 'SOL', 'TRON'];

interface ExportResult {
  chain: CryptoChain;
  address: string;
  privateKey: string;
  importInstructions: string;
  exportedAt: string;
}

function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`mr-2 rounded-full px-3 py-1 ${
        active
          ? 'bg-red-600'
          : 'bg-red-100 dark:bg-red-950'
      }`}
    >
      <Text
        className={`text-xs font-semibold ${
          active ? 'text-white' : 'text-red-700 dark:text-red-200'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SelfCustodyExport() {
  const [stage, setStage] = useState<Stage>('warn');
  const [chain, setChain] = useState<CryptoChain>('ETH');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [acceptedRisk, setAcceptedRisk] = useState(false);
  const [ack, setAck] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit() {
    // Biometric gate before the network call.
    const hw = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (hw && enrolled) {
      const r = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to reveal private key',
      });
      if (!r.success) {
        setError('Biometric check failed');
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const res = await cryptoWalletAPI.export({
        chain,
        password,
        twoFactorCode,
        confirmUnderstood: true,
      });
      setResult(res.data);
      setPassword('');
      setTwoFactorCode('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setStage('reveal');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Export failed');
    } finally {
      setLoading(false);
    }
  }

  async function copyKey() {
    if (!result) return;
    await Clipboard.setStringAsync(result.privateKey);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function reset() {
    setResult(null);
    setAcceptedRisk(false);
    setAck(false);
    setError(null);
    setStage('warn');
  }

  return (
    <View className="rounded-2xl border-2 border-red-400 bg-red-50 p-5 dark:border-red-600 dark:bg-red-950">
      <View className="mb-3 flex-row items-center">
        <Text className="text-lg font-bold text-red-700 dark:text-red-200">
          Self-custody export
        </Text>
        <View className="ml-2 rounded-full bg-red-600 px-2 py-0.5">
          <Text className="text-[10px] font-bold text-white">IRREVERSIBLE</Text>
        </View>
      </View>

      {stage === 'warn' && (
        <>
          <Text className="text-sm text-neutral-800 dark:text-neutral-200">
            You are about to export the private key for your {chain} wallet.
          </Text>
          <View className="mt-2">
            {[
              'We will stop custodying this chain for you.',
              `Your custodial balance for ${chain} will become 0.`,
              'We cannot recover a lost or stolen private key.',
              'Only import into a wallet you fully trust.',
            ].map((l) => (
              <Text key={l} className="text-sm text-neutral-700 dark:text-neutral-300">
                •  {l}
              </Text>
            ))}
          </View>

          <View className="my-4 flex-row flex-wrap">
            {CHAINS.map((c) => (
              <Pill
                key={c}
                label={c}
                active={chain === c}
                onPress={() => setChain(c)}
              />
            ))}
          </View>

          <Pressable
            onPress={() => setAcceptedRisk((x) => !x)}
            className="flex-row items-center"
          >
            <View
              className={`mr-2 h-5 w-5 rounded border border-red-500 ${
                acceptedRisk ? 'bg-red-600' : 'bg-transparent'
              }`}
            />
            <Text className="text-sm text-neutral-800 dark:text-neutral-200">
              I understand the risks and accept responsibility.
            </Text>
          </Pressable>

          <Pressable
            disabled={!acceptedRisk}
            onPress={() => setStage('auth')}
            className={`mt-4 items-center rounded-lg py-3 ${
              acceptedRisk ? 'bg-red-600' : 'bg-neutral-400'
            }`}
          >
            <Text className="font-semibold text-white">Continue</Text>
          </Pressable>
        </>
      )}

      {stage === 'auth' && (
        <>
          <Text className="mb-3 text-sm text-neutral-800 dark:text-neutral-200">
            Confirm password and 2FA to reveal the {chain} private key.
          </Text>
          <TextInput
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#9ca3af"
            className="mb-2 rounded-lg border border-neutral-300 bg-white px-3 py-3 text-base text-neutral-900"
          />
          <TextInput
            value={twoFactorCode}
            onChangeText={setTwoFactorCode}
            placeholder="6-digit 2FA code"
            placeholderTextColor="#9ca3af"
            keyboardType="number-pad"
            maxLength={8}
            className="mb-2 rounded-lg border border-neutral-300 bg-white px-3 py-3 text-base text-neutral-900"
          />
          {error && <Text className="mt-1 text-sm text-red-600">{error}</Text>}

          <View className="mt-3 flex-row">
            <Pressable
              onPress={() => setStage('warn')}
              className="mr-2 flex-1 items-center rounded-lg border border-red-400 py-3"
            >
              <Text className="font-semibold text-red-600">Back</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={loading || !password || twoFactorCode.length < 6}
              className={`flex-[2] items-center rounded-lg py-3 ${
                loading || !password || twoFactorCode.length < 6
                  ? 'bg-neutral-400'
                  : 'bg-red-600'
              }`}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="font-semibold text-white">Reveal private key</Text>
              )}
            </Pressable>
          </View>
        </>
      )}

      {stage === 'reveal' && result && (
        <>
          <View className="mb-3 rounded-lg bg-amber-100 p-3 dark:bg-amber-900">
            <Text className="text-xs text-amber-800 dark:text-amber-100">
              This key is shown <Text className="font-bold">once</Text>. Save it now.
            </Text>
          </View>

          <Text className="text-xs text-neutral-600 dark:text-neutral-400">Address</Text>
          <Text selectable className="font-mono text-xs text-neutral-900 dark:text-white">
            {result.address}
          </Text>

          <Text className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
            Private key
          </Text>
          <View className="mt-1 rounded-lg bg-white p-3 dark:bg-neutral-800">
            <Text selectable className="font-mono text-xs text-red-700 dark:text-red-300">
              {result.privateKey}
            </Text>
          </View>

          <Pressable
            onPress={copyKey}
            className="mt-3 items-center rounded-lg bg-neutral-900 py-3"
          >
            <Text className="font-semibold text-white">
              {copied ? 'Copied!' : 'Copy private key'}
            </Text>
          </Pressable>

          <Text className="mt-3 text-sm text-neutral-800 dark:text-neutral-200">
            <Text className="font-bold">How to import: </Text>
            {result.importInstructions}
          </Text>

          <Pressable
            onPress={() => setAck((x) => !x)}
            className="mt-3 flex-row items-center"
          >
            <View
              className={`mr-2 h-5 w-5 rounded border border-red-500 ${
                ack ? 'bg-red-600' : 'bg-transparent'
              }`}
            />
            <Text className="text-sm text-neutral-800 dark:text-neutral-200">
              I&apos;ve saved this private key somewhere safe.
            </Text>
          </Pressable>

          <Pressable
            disabled={!ack}
            onPress={() => setStage('done')}
            className={`mt-4 items-center rounded-lg py-3 ${
              ack ? 'bg-red-600' : 'bg-neutral-400'
            }`}
          >
            <Text className="font-semibold text-white">Finish</Text>
          </Pressable>
        </>
      )}

      {stage === 'done' && (
        <>
          <Text className="mb-3 text-sm text-neutral-800 dark:text-neutral-200">
            Export complete. Your custodial {result?.chain} balance is now 0.
          </Text>
          <Pressable
            onPress={reset}
            className="items-center rounded-lg border border-red-400 py-3"
          >
            <Text className="font-semibold text-red-600">Close</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

export default SelfCustodyExport;
