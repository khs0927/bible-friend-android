import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import Consent from '@/app/consent';

const mockUpdate = jest.fn();
const mockRefresh = jest.fn(() => Promise.resolve());

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('@/lib/auth', () => ({ signOut: jest.fn() }));
jest.mock('@/lib/session', () => ({
  CONSENT_VERSION: 'test-version',
  useSession: () => ({ session: { user: { id: 'guardian-1' } }, refresh: mockRefresh }),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: (values: unknown) => {
        mockUpdate(values);
        return { eq: () => Promise.resolve({ error: null }) };
      },
    }),
  },
}));

const startButton = () => screen.getByRole('button', { name: '동의하고 시작하기' });

describe('Consent (법정대리인 동의)', () => {
  beforeEach(() => {
    mockUpdate.mockClear();
    mockRefresh.mockClear();
  });

  it('keeps the start button disabled until every required item is checked', async () => {
    const user = userEvent.setup();
    await render(<Consent />);
    expect(startButton()).toBeDisabled();

    // checkboxes: [전체 동의, guardian, terms, privacy, ai, marketing]
    for (const index of [1, 2, 3]) await user.press(screen.getAllByRole('checkbox')[index]!);
    expect(startButton()).toBeDisabled();
    await user.press(screen.getAllByRole('checkbox')[4]!);
    expect(startButton()).toBeEnabled();
  });

  it('records consent without marketing when only required items are accepted', async () => {
    const user = userEvent.setup();
    await render(<Consent />);
    for (const index of [1, 2, 3, 4]) await user.press(screen.getAllByRole('checkbox')[index]!);
    await user.press(startButton());

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ consent_version: 'test-version', marketing_opt_in: false, consented_at: expect.any(String) }),
    );
  });

  it('"전체 동의" checks everything including the optional item', async () => {
    const user = userEvent.setup();
    await render(<Consent />);
    await user.press(screen.getAllByRole('checkbox')[0]!);
    expect(startButton()).toBeEnabled();
    await user.press(startButton());
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ marketing_opt_in: true })));
  });
});
