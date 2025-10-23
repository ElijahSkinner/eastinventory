import { Platform } from 'react-native';

// HTTPS for web, HTTP for mobile (development only!)
export const API_CONFIG = {
    endpoint: Platform.select({
        web: 'https://10.2.1.47/v1',
        default: 'http://10.2.1.47:8081/v1'
    }),
    projectId: 'east-inventory'
};