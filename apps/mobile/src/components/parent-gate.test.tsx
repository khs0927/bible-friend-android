import { render, screen, userEvent } from '@testing-library/react-native';

import { ParentGate } from './parent-gate';

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));

describe('ParentGate', () => {
  beforeEach(() => {
    // Math.random() = 0 → question "6 × 6 = ?"
    jest.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => jest.restoreAllMocks());

  it('only lets a correct answer through', async () => {
    const user = userEvent.setup();
    const onPass = jest.fn();
    await render(<ParentGate visible onPass={onPass} onCancel={jest.fn()} />);

    expect(screen.getByText('6 × 6 = ?')).toBeTruthy();
    await user.type(screen.getByLabelText('답 입력'), '35');
    await user.press(screen.getByRole('button', { name: '확인' }));
    expect(onPass).not.toHaveBeenCalled();
    expect(screen.getByText('답이 달라요. 새 문제로 다시 해 주세요.')).toBeTruthy();

    await user.type(screen.getByLabelText('답 입력'), '36');
    await user.press(screen.getByRole('button', { name: '확인' }));
    expect(onPass).toHaveBeenCalledTimes(1);
  });

  it('cancels without passing', async () => {
    const user = userEvent.setup();
    const onPass = jest.fn();
    const onCancel = jest.fn();
    await render(<ParentGate visible onPass={onPass} onCancel={onCancel} />);
    await user.press(screen.getByRole('button', { name: '취소' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onPass).not.toHaveBeenCalled();
  });
});
