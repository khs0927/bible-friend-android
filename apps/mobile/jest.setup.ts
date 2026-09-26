// Jest setup for component tests (jest-expo preset).
import 'react-native-gesture-handler/jestSetup';

// Native keyboard module → the library's official mock.
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
