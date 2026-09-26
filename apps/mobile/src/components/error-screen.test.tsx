import { render, screen, userEvent } from '@testing-library/react-native';

import { ErrorScreen } from './error-screen';

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));

describe('ErrorScreen', () => {
  it('shows a child-friendly message and retries', async () => {
    const user = userEvent.setup();
    const retry = jest.fn(() => Promise.resolve());
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await render(<ErrorScreen error={new Error('boom')} retry={retry} />);

    expect(screen.getByText('앗, 잠깐 넘어졌어요')).toBeTruthy();
    await user.press(screen.getByRole('button', { name: '다시 해 보기' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
