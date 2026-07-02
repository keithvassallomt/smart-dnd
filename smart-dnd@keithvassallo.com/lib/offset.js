export const MAG_MINUTES = [1, 5, 10, 15];
const CUSTOM_INDEX = MAG_MINUTES.length;

export function offsetToUi(min) {
    if (min === 0) return {direction: 0, magIndex: 0, custom: 0};
    const direction = min < 0 ? 1 : 2;
    const abs = Math.abs(min);
    const magIndex = MAG_MINUTES.indexOf(abs);
    if (magIndex >= 0) return {direction, magIndex, custom: 0};
    return {direction, magIndex: CUSTOM_INDEX, custom: abs};
}

export function uiToOffset(direction, magIndex, custom) {
    if (direction === 0) return 0;
    const val = magIndex === CUSTOM_INDEX ? custom : MAG_MINUTES[magIndex];
    return direction === 1 ? -val : val;
}
