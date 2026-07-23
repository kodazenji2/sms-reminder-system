export const PHONE_LOGIN_EMAIL_DOMAIN = "nict.edu.ng";

export function isPhoneLikeIdentifier(value: string) {
    const trimmed = value.trim();
    if (!trimmed || trimmed.includes("@")) return false;
    const onlyDigits = trimmed.replace(/\D/g, "");
    return /^\+?\d+$/.test(trimmed) && onlyDigits.length >= 8;
}

export function phoneToPseudoEmail(phone: string) {
    const trimmed = phone.trim();
    const onlyDigits = trimmed.replace(/\D/g, "");

    if (!onlyDigits) return "";

    return `${onlyDigits}@${PHONE_LOGIN_EMAIL_DOMAIN}`;
}

export function resolveLoginIdentifier(input: string) {
    const trimmed = input.trim();
    if (!trimmed) return trimmed;

    if (trimmed.includes("@")) return trimmed;
    if (isPhoneLikeIdentifier(trimmed)) return phoneToPseudoEmail(trimmed);

    return trimmed;
}
