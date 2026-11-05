import { useEffect, useRef } from "react";

type Props = {
  manifest: string;
  disabled?: boolean;
  onBeforeActivate?: () => void | Promise<void>;
};

/**
 * 包装 esp-web-tools 自定义元素，避免 JSX 对未知标签的类型报错。
 */
export function EspWebInstallButton({ manifest, disabled, onBeforeActivate }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void import("esp-web-tools/dist/web/install-button.js").then(() => {
      if (cancelled || !hostRef.current) return;
      hostRef.current.innerHTML = "";
      const el = document.createElement("esp-web-install-button");
      el.setAttribute("manifest", manifest);

      const btn = document.createElement("button");
      btn.setAttribute("slot", "activate");
      btn.type = "button";
      btn.className = "btn-secondary";
      btn.textContent = "esp-web-tools 烧录";
      btn.disabled = !!disabled;
      btn.addEventListener("click", () => {
        void onBeforeActivate?.();
      });

      const unsupported = document.createElement("span");
      unsupported.setAttribute("slot", "unsupported");
      unsupported.textContent = "当前浏览器不支持 Web Serial";

      const notAllowed = document.createElement("span");
      notAllowed.setAttribute("slot", "not-allowed");
      notAllowed.textContent = "请在安全上下文（localhost / HTTPS）中使用";

      el.append(btn, unsupported, notAllowed);
      hostRef.current.appendChild(el);
    });

    return () => {
      cancelled = true;
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
  }, [manifest, disabled, onBeforeActivate]);

  return <div ref={hostRef} className="inline-flex" />;
}
