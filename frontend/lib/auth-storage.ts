import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getItem, removeItem, setItem } from '@/lib/storage';

const AUTH_TOKEN_KEY = 'auth_token';

const getWebToken = () => {
	if (typeof window === 'undefined') return null;
	return window.sessionStorage.getItem(AUTH_TOKEN_KEY);
};

const setWebToken = (token: string) => {
	if (typeof window !== 'undefined') window.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
};

const clearWebToken = () => {
	if (typeof window !== 'undefined') window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
};

export async function getAuthToken() {
	if (Platform.OS === 'web') return getWebToken();
	try {
		return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
	} catch (error) {
		console.warn('[auth] SecureStore unavailable; using AsyncStorage fallback.', error);
		return getItem(AUTH_TOKEN_KEY);
	}
}

export async function setAuthToken(token: string) {
	if (Platform.OS === 'web') {
		setWebToken(token);
		return;
	}
	try {
		await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
		await removeItem(AUTH_TOKEN_KEY);
	} catch (error) {
		console.warn('[auth] SecureStore unavailable; using AsyncStorage fallback.', error);
		await setItem(AUTH_TOKEN_KEY, token);
	}
}

export async function clearAuthToken() {
	if (Platform.OS === 'web') {
		clearWebToken();
		return;
	}
	try {
		await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
	} catch (error) {
		console.warn('[auth] SecureStore unavailable while clearing token.', error);
	}
	await removeItem(AUTH_TOKEN_KEY);
}