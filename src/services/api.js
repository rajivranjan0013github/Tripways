import Config from 'react-native-config';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();
const BACKEND_URL = Config.BACKEND_URL || 'http://localhost:3000';

/**
 * Get the stored user ID from MMKV
 */
export const getUserId = () => {
    try {
        const userStr = storage.getString('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            return user?.id || user?._id || null;
        }
    } catch (e) {
        console.warn('Failed to get user ID:', e);
    }
    return null;
};

/**
 * Get the stored user object from MMKV
 */
export const getStoredUser = () => {
    try {
        const userStr = storage.getString('user');
        if (userStr) {
            return JSON.parse(userStr);
        }
    } catch (e) {
        console.warn('Failed to get stored user:', e);
    }
    return null;
};

/**
 * API helper — GET request
 */
export const apiGet = async (path) => {
    const res = await fetch(`${BACKEND_URL}${path}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
};

/**
 * API helper — POST request
 */
export const apiPost = async (path, body) => {
    const res = await fetch(`${BACKEND_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return res.json();
};

/**
 * API helper — DELETE request
 */
export const apiDelete = async (path) => {
    const res = await fetch(`${BACKEND_URL}${path}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
};
