import { StudentDeviceInfo, StudentRecord } from '../types/student';

export function detectBrowserFromUA(ua: string): string {
  const s = ua || '';
  if (!s) return 'متصفح غير معروف';

  if (/SamsungBrowser\/([0-9.]+)/i.test(s)) {
    const ver = s.match(/SamsungBrowser\/(\d+)/i)?.[1];
    return ver ? `Samsung Internet ${ver}` : 'Samsung Internet';
  }
  if (/Edg(?:A|iOS)?\/([0-9.]+)/i.test(s)) {
    const ver = s.match(/Edg(?:A|iOS)?\/(\d+)/i)?.[1];
    return ver ? `Microsoft Edge ${ver}` : 'Microsoft Edge';
  }
  if (/OPR\/([0-9.]+)|Opera\/([0-9.]+)/i.test(s)) {
    const ver = s.match(/(?:OPR|Opera)\/(\d+)/i)?.[1];
    return ver ? `Opera ${ver}` : 'Opera';
  }
  if (/FxiOS\/([0-9.]+)|Firefox\/([0-9.]+)/i.test(s)) {
    const ver = s.match(/(?:FxiOS|Firefox)\/(\d+)/i)?.[1];
    return ver ? `Firefox ${ver}` : 'Firefox';
  }
  if (/CriOS\/([0-9.]+)|Chrome\/([0-9.]+)/i.test(s)) {
    const ver = s.match(/(?:CriOS|Chrome)\/(\d+)/i)?.[1];
    return ver ? `Google Chrome ${ver}` : 'Google Chrome';
  }
  if (/Safari\/([0-9.]+)/i.test(s)) {
    const ver = s.match(/Version\/(\d+)/i)?.[1];
    return ver ? `Safari ${ver}` : 'Safari';
  }
  return 'متصفح ويب';
}

export function detectOSFromUA(ua: string, maxTouchPoints = 0): string {
  const s = ua || '';
  if (/Android/i.test(s)) return 'Android';
  if (/iPad/i.test(s) || (/Macintosh/i.test(s) && maxTouchPoints > 1)) return 'iPadOS';
  if (/iPhone|iPod/i.test(s)) return 'iOS';
  if (/Windows NT|Win64|Win32|Windows/i.test(s)) return 'Windows';
  if (/CrOS/i.test(s)) return 'ChromeOS';
  if (/Mac OS X|Macintosh/i.test(s)) return 'macOS';
  if (/Linux/i.test(s)) return 'Linux';
  return 'نظام آخر';
}

export function detectDeviceTypeFromUA(
  ua: string,
  maxTouchPoints = 0
): StudentDeviceInfo['deviceType'] {
  const s = ua || '';
  if (
    /iPad|Tablet|PlayBook|Silk|Kindle|SM-T/i.test(s) ||
    (/Macintosh/i.test(s) && maxTouchPoints > 1) ||
    (/Android/i.test(s) && !/Mobile/i.test(s))
  ) {
    return 'تابلت';
  }
  if (/Mobile|iPhone|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(s)) {
    return 'موبايل';
  }
  return 'كمبيوتر';
}

export function parseUserAgentDetails(
  userAgent: string,
  deviceId = 'dev-browser',
  lastSeenAt = new Date().toISOString(),
  maxTouchPoints = 0
): StudentDeviceInfo {
  const browser = detectBrowserFromUA(userAgent).slice(0, 60);
  const os = detectOSFromUA(userAgent, maxTouchPoints).slice(0, 40);
  const deviceType = detectDeviceTypeFromUA(userAgent, maxTouchPoints);
  const label = `${deviceType} (${os}) · ${browser}`.slice(0, 120);

  return {
    id: deviceId.slice(0, 100),
    browser,
    os,
    deviceType,
    label,
    lastSeenAt: lastSeenAt.slice(0, 40),
  };
}

export function getClientDeviceInfo(deviceId: string): StudentDeviceInfo {
  if (typeof navigator === 'undefined') {
    return parseUserAgentDetails('', deviceId);
  }
  const touchPoints =
    typeof navigator.maxTouchPoints === 'number' ? navigator.maxTouchPoints : 0;
  return parseUserAgentDetails(
    navigator.userAgent || '',
    deviceId,
    new Date().toISOString(),
    touchPoints
  );
}

export function sanitizeDeviceInfo(
  raw: unknown,
  deviceId: string,
  fallbackUA = ''
): StudentDeviceInfo {
  if (raw && typeof raw === 'object') {
    const obj = raw as Partial<StudentDeviceInfo>;
    const validType: StudentDeviceInfo['deviceType'] =
      obj.deviceType === 'موبايل' || obj.deviceType === 'تابلت' || obj.deviceType === 'كمبيوتر'
        ? obj.deviceType
        : detectDeviceTypeFromUA(fallbackUA);
    const browser =
      typeof obj.browser === 'string' && obj.browser.trim()
        ? obj.browser.trim().slice(0, 60)
        : detectBrowserFromUA(fallbackUA);
    const os =
      typeof obj.os === 'string' && obj.os.trim()
        ? obj.os.trim().slice(0, 40)
        : detectOSFromUA(fallbackUA);
    const lastSeenAt =
      typeof obj.lastSeenAt === 'string' && obj.lastSeenAt.trim()
        ? obj.lastSeenAt.trim().slice(0, 40)
        : new Date().toISOString();
    const label =
      typeof obj.label === 'string' && obj.label.trim()
        ? obj.label.trim().slice(0, 120)
        : `${validType} (${os}) · ${browser}`.slice(0, 120);
    return {
      id: deviceId.slice(0, 100),
      browser,
      os,
      deviceType: validType,
      label,
      lastSeenAt,
    };
  }
  return parseUserAgentDetails(fallbackUA, deviceId);
}

export function mergeStudentDeviceEntry(
  existingIds: string[] | undefined,
  existingDetails: Record<string, StudentDeviceInfo> | undefined,
  deviceId: string,
  info: StudentDeviceInfo
): {
  activeDeviceIds: string[];
  deviceDetails: Record<string, StudentDeviceInfo>;
} {
  const cleanId = deviceId.trim().slice(0, 100);
  const currentIds = Array.isArray(existingIds)
    ? existingIds.filter((d) => typeof d === 'string' && d.trim().length > 0)
    : [];
  const nextIds = currentIds.includes(cleanId)
    ? currentIds.slice(0, 20)
    : [...currentIds, cleanId].slice(0, 20);

  const nextDetails: Record<string, StudentDeviceInfo> = {};
  const allowedSet = new Set(nextIds);
  if (existingDetails && typeof existingDetails === 'object') {
    for (const [k, v] of Object.entries(existingDetails)) {
      if (allowedSet.has(k) && v && typeof v === 'object') {
        nextDetails[k] = sanitizeDeviceInfo(v, k);
      }
    }
  }
  if (allowedSet.has(cleanId)) {
    nextDetails[cleanId] = {
      ...info,
      id: cleanId,
    };
  }

  return {
    activeDeviceIds: nextIds,
    deviceDetails: nextDetails,
  };
}

export interface NormalizedDeviceDisplay {
  id: string;
  browser: string;
  os: string;
  deviceType: StudentDeviceInfo['deviceType'];
  label: string;
  lastSeenAt: string | null;
  hasDetails: boolean;
}

export function getStudentDevicesDisplay(
  student: Pick<StudentRecord, 'activeDeviceIds' | 'deviceDetails'>
): NormalizedDeviceDisplay[] {
  const ids = Array.isArray(student.activeDeviceIds) ? student.activeDeviceIds : [];
  const detailsMap =
    student.deviceDetails && typeof student.deviceDetails === 'object'
      ? student.deviceDetails
      : {};

  const orderedIds = [...ids];
  for (const k of Object.keys(detailsMap)) {
    if (!orderedIds.includes(k)) orderedIds.push(k);
  }

  return orderedIds.map((id) => {
    const info = detailsMap[id];
    if (info && typeof info === 'object') {
      const deviceType: StudentDeviceInfo['deviceType'] =
        info.deviceType === 'موبايل' || info.deviceType === 'تابلت' || info.deviceType === 'كمبيوتر'
          ? info.deviceType
          : 'كمبيوتر';
      const browser = info.browser || 'متصفح ويب';
      const os = info.os || 'غير محدد';
      return {
        id,
        browser,
        os,
        deviceType,
        label: info.label || `${deviceType} (${os}) · ${browser}`,
        lastSeenAt: info.lastSeenAt || null,
        hasDetails: true,
      };
    }
    return {
      id,
      browser: 'متصفح مسجّل سابقًا',
      os: 'غير محدد',
      deviceType: 'كمبيوتر',
      label: 'جهاز مسجّل (بدون تفاصيل متصفح)',
      lastSeenAt: null,
      hasDetails: false,
    };
  });
}
