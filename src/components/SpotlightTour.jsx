/**
 * SpotlightTour — STRIPPED DOWN debug version.
 * No Reanimated, no complex logic. Just Modal + Views to verify rendering.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    useWindowDimensions,
    StatusBar,
    Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PAD = 10;
const CUTOUT_R = 14;
const TIP_GAP = 18;
const MAX_RETRIES = 20;
const RETRY_MS = 80;

const STEPS = [
    {
        emoji: '✈️',
        title: 'Create a trip',
        body: 'Tap Create to build a full itinerary — just pick a city and go.',
        cta: 'Next',
        pos: 'above',
        color: '#6366F1',
        grad: ['#6366F1', '#818CF8'],
        iconBg: '#EEF2FF',
    },
    {
        emoji: '🔍',
        title: 'Search & save spots',
        body: 'Search any place on earth and save it to your bucket list in one tap.',
        cta: 'Next',
        pos: 'below',
        color: '#0EA5E9',
        grad: ['#0EA5E9', '#38BDF8'],
        iconBg: '#F0F9FF',
    },
    {
        emoji: '🎬',
        title: 'Import from videos',
        body: 'Share a reel or TikTok → we auto-extract every place from the video.',
        cta: 'Got it!',
        pos: 'below',
        color: '#10B981',
        grad: ['#10B981', '#34D399'],
        iconBg: '#ECFDF5',
    },
];

export default function SpotlightTour({
    visible, onDismiss, createTabRef, searchBarRef, importedBtnRef, onStepChange,
}) {
    const insets = useSafeAreaInsets();
    const { width: SW, height: SH } = useWindowDimensions();

    const [step, setStep] = useState(0);
    const [rect, setRect] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const stepRef = useRef(0);
    const retriesRef = useRef(0);
    const timerRef = useRef(null);
    const mountedRef = useRef(true);

    // ─── Measure with retries ───
    const measureRef = useCallback((ref, onOk, onFail) => {
        retriesRef.current = 0;
        if (timerRef.current) clearTimeout(timerRef.current);

        const attempt = () => {
            if (!mountedRef.current) return;
            if (!ref?.current) {
                if (retriesRef.current < MAX_RETRIES) {
                    retriesRef.current++;
                    timerRef.current = setTimeout(attempt, RETRY_MS);
                } else onFail?.();
                return;
            }
            try {
                ref.current.measureInWindow((x, y, w, h) => {
                    if (!mountedRef.current) return;
                    if (w > 0 && h > 0) {
                        onOk({ x, y, w, h });
                    } else if (retriesRef.current < MAX_RETRIES) {
                        retriesRef.current++;
                        timerRef.current = setTimeout(attempt, RETRY_MS);
                    } else onFail?.();
                });
            } catch {
                if (retriesRef.current < MAX_RETRIES) {
                    retriesRef.current++;
                    timerRef.current = setTimeout(attempt, RETRY_MS);
                } else onFail?.();
            }
        };
        attempt();
    }, []);

    const getRef = useCallback((s) => {
        return s === 0 ? createTabRef : s === 1 ? searchBarRef : importedBtnRef;
    }, [createTabRef, searchBarRef, importedBtnRef]);

    // Android fix: measureInWindow gives Y without status bar, but Modal includes it
    const statusBarOffset = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;

    const showStep = useCallback((s) => {
        measureRef(
            getRef(s),
            (m) => {
                const adjustedY = m.y + statusBarOffset;
                setRect({
                    x: m.x - PAD,
                    y: adjustedY - PAD,
                    width: m.w + PAD * 2,
                    height: m.h + PAD * 2,
                });
            },
            () => {
                const sbO = statusBarOffset;
                if (s === 0) setRect({ x: SW / 2 - 54, y: SH - insets.bottom - 68 + sbO, width: 108, height: 74 });
                else if (s === 1) setRect({ x: 6, y: SH * 0.39 + sbO, width: SW - 12, height: 68 });
                else setRect({ x: SW * 0.36, y: SH * 0.43 + sbO, width: SW * 0.60, height: 62 });
            },
        );
    }, [getRef, measureRef, SW, SH, insets.bottom, statusBarOffset]);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; if (timerRef.current) clearTimeout(timerRef.current); };
    }, []);

    useEffect(() => {
        if (visible) {
            setModalVisible(true);
            setStep(0);
            stepRef.current = 0;
            setRect(null);
            const t = setTimeout(() => showStep(0), 400);
            return () => clearTimeout(t);
        } else {
            setModalVisible(false);
            setRect(null);
        }
    }, [visible]);

    const next = useCallback(() => {
        const c = stepRef.current;
        if (c < STEPS.length - 1) {
            const n = c + 1;
            stepRef.current = n;
            setRect(null);
            onStepChange?.(n);
            setTimeout(() => {
                if (!mountedRef.current) return;
                setStep(n);
                showStep(n);
            }, 200);
        } else {
            onDismiss();
        }
    }, [onStepChange, onDismiss, showStep]);

    const skip = useCallback(() => { onDismiss(); }, [onDismiss]);

    if (!modalVisible) return null;

    const s = STEPS[step];
    const isLast = step === STEPS.length - 1;

    // Tooltip position
    const tipPos = {};
    if (rect) {
        if (s.pos === 'above') tipPos.bottom = SH - rect.y + TIP_GAP;
        else tipPos.top = rect.y + rect.height + TIP_GAP;
    }

    const arrowL = rect
        ? Math.min(Math.max(rect.x + rect.width / 2 - 10, 36), SW - 56) - 20
        : SW / 2 - 30;

    return (
        <Modal
            visible
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={skip}
        >
            <View style={{ flex: 1 }}>
                {/* ══════ OVERLAY ══════ */}
                {/* If rect is null, show full dark overlay. If rect exists, show 4 blocks around it. */}
                {!rect ? (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.78)' }]} />
                ) : (
                    <>
                        {/* Top block */}
                        <View style={{
                            position: 'absolute', top: 0, left: 0, right: 0,
                            height: Math.max(rect.y, 0),
                            backgroundColor: 'rgba(0,0,0,0.78)',
                        }} />
                        {/* Left block */}
                        <View style={{
                            position: 'absolute', top: rect.y, left: 0,
                            width: Math.max(rect.x, 0), height: rect.height,
                            backgroundColor: 'rgba(0,0,0,0.78)',
                        }} />
                        {/* Right block */}
                        <View style={{
                            position: 'absolute', top: rect.y, right: 0,
                            left: rect.x + rect.width, height: rect.height,
                            backgroundColor: 'rgba(0,0,0,0.78)',
                        }} />
                        {/* Bottom block */}
                        <View style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            top: rect.y + rect.height,
                            backgroundColor: 'rgba(0,0,0,0.78)',
                        }} />
                        {/* Cutout border */}
                        <View style={{
                            position: 'absolute',
                            left: rect.x,
                            top: rect.y,
                            width: rect.width,
                            height: rect.height,
                            borderRadius: CUTOUT_R,
                            borderWidth: 2,
                            borderColor: 'rgba(255,255,255,0.5)',
                        }} />
                    </>
                )}

                {/* ══════ TOOLTIP ══════ */}
                {rect && (
                    <View style={[styles.tipWrap, tipPos]}>
                        {/* Arrow */}
                        <View style={[
                            styles.arrow,
                            s.pos === 'above' ? styles.arrowD : styles.arrowU,
                            { left: arrowL },
                        ]} />

                        <View style={styles.card}>
                            <LinearGradient
                                colors={s.grad}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.stripe}
                            />

                            <View style={styles.header}>
                                <View style={styles.dots}>
                                    {STEPS.map((_, i) => (
                                        <View key={i} style={[
                                            styles.dot,
                                            i === step && { backgroundColor: s.color, width: 18, borderRadius: 5 },
                                            i < step && { backgroundColor: s.color + '35' },
                                        ]} />
                                    ))}
                                </View>
                                <TouchableOpacity onPress={skip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.skipBtn}>
                                    <Text style={styles.skipTxt}>Skip</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.titleRow}>
                                <View style={[styles.emojiPill, { backgroundColor: s.iconBg }]}>
                                    <Text style={styles.emoji}>{s.emoji}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.stepLabel, { color: s.color }]}>
                                        Step {step + 1} of {STEPS.length}
                                    </Text>
                                    <Text style={styles.title}>{s.title}</Text>
                                </View>
                            </View>

                            <Text style={styles.body}>{s.body}</Text>

                            <TouchableOpacity style={styles.cta} onPress={next} activeOpacity={0.85}>
                                <LinearGradient
                                    colors={s.grad}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.ctaInner}
                                >
                                    <Text style={styles.ctaTxt}>{s.cta}</Text>
                                    <Svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <Path d={isLast ? "M20 6 9 17l-5-5" : "m9 18 6-6-6-6"} />
                                    </Svg>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    tipWrap: {
        position: 'absolute',
        left: 20,
        right: 20,
        zIndex: 10,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        overflow: 'hidden',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 28,
    },
    stripe: { height: 4, width: '100%' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E2E8F0' },
    skipBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, backgroundColor: '#F1F5F9' },
    skipTxt: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 6,
    },
    emojiPill: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    emoji: { fontSize: 22 },
    stepLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 2 },
    title: { fontSize: 19, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
    body: { fontSize: 14.5, lineHeight: 22, color: '#64748B', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 18 },
    cta: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, overflow: 'hidden', elevation: 8 },
    ctaInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48 },
    ctaTxt: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
    arrow: {
        position: 'absolute', width: 0, height: 0,
        borderLeftWidth: 11, borderRightWidth: 11,
        borderLeftColor: 'transparent', borderRightColor: 'transparent',
        zIndex: 20,
    },
    arrowU: { top: -10, borderBottomWidth: 11, borderBottomColor: '#FFFFFF' },
    arrowD: { bottom: -10, borderTopWidth: 11, borderTopColor: '#FFFFFF' },
});
