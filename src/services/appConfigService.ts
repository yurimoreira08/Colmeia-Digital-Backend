import { getConfig, setConfig } from '../data/repositories/configRepository.js';

export { getConfig, setConfig };

const TEST_DATA_ENABLED_KEY = 'test_data_enabled';

export async function getIsTestDataEnabled(): Promise<boolean> {
  const value = await getConfig(TEST_DATA_ENABLED_KEY);
  return value === '1';
}

export async function setIsTestDataEnabled(enabled: boolean): Promise<void> {
  await setConfig(TEST_DATA_ENABLED_KEY, enabled ? '1' : '0');
}
