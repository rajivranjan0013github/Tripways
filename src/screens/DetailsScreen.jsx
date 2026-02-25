/**
 * Details Screen
 * @format
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DetailsScreen = ({ route, navigation }) => {
    const { title = 'Details' } = route.params || {};

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Custom Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                        activeOpacity={0.7}>
                        <Text style={styles.backArrow}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{title}</Text>
                    <View style={styles.backButton} />
                </View>

                {/* Hero Section */}
                <View style={styles.heroSection}>
                    <View style={styles.heroGradient}>
                        <Text style={styles.heroEmoji}>🌍</Text>
                        <Text style={styles.heroTitle}>{title}</Text>
                        <Text style={styles.heroSubtitle}>
                            Discover amazing experiences
                        </Text>
                    </View>
                </View>

                {/* Info Cards */}
                <View style={styles.infoSection}>
                    <View style={styles.infoCard}>
                        <Text style={styles.infoIcon}>📍</Text>
                        <Text style={styles.infoLabel}>Location</Text>
                        <Text style={styles.infoValue}>{title}</Text>
                    </View>
                    <View style={styles.infoCard}>
                        <Text style={styles.infoIcon}>⭐</Text>
                        <Text style={styles.infoLabel}>Rating</Text>
                        <Text style={styles.infoValue}>4.8</Text>
                    </View>
                    <View style={styles.infoCard}>
                        <Text style={styles.infoIcon}>💰</Text>
                        <Text style={styles.infoLabel}>Budget</Text>
                        <Text style={styles.infoValue}>$$</Text>
                    </View>
                </View>

                {/* Description */}
                <View style={styles.descSection}>
                    <Text style={styles.descTitle}>About</Text>
                    <Text style={styles.descText}>
                        Explore the beauty of {title}. Plan your perfect itinerary, discover
                        hidden gems, and create unforgettable memories on your journey.
                    </Text>
                </View>

                {/* CTA Button */}
                <TouchableOpacity style={styles.ctaButton} activeOpacity={0.8}>
                    <Text style={styles.ctaText}>Start Planning ✈️</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a2e',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    backArrow: {
        fontSize: 20,
        color: '#ffffff',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#ffffff',
    },
    heroSection: {
        paddingHorizontal: 24,
        marginTop: 10,
    },
    heroGradient: {
        backgroundColor: '#0f3460',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    heroEmoji: {
        fontSize: 60,
        marginBottom: 14,
    },
    heroTitle: {
        fontSize: 26,
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: 6,
    },
    heroSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
    },
    infoSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        marginTop: 24,
    },
    infoCard: {
        backgroundColor: '#16213e',
        borderRadius: 14,
        padding: 16,
        alignItems: 'center',
        flex: 1,
        marginHorizontal: 5,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    infoIcon: {
        fontSize: 24,
        marginBottom: 8,
    },
    infoLabel: {
        fontSize: 11,
        color: '#7a7a9a',
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
    },
    descSection: {
        paddingHorizontal: 24,
        marginTop: 28,
    },
    descTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#e0e0f0',
        marginBottom: 10,
    },
    descText: {
        fontSize: 14,
        lineHeight: 22,
        color: '#8a8aa8',
    },
    ctaButton: {
        marginHorizontal: 24,
        marginTop: 30,
        backgroundColor: '#e94560',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
    },
    ctaText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
    },
});

export default DetailsScreen;
