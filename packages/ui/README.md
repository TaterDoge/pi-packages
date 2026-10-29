# @taterdoge/ui

shadcn/ui (`base-nova`) 组件源码 + 主题 + Tailwind 样式表，供带浏览器页面的 Pi 扩展共享。

**只共享重复定义的东西。** 这个包不含路由、不含 server、不含任何「配置表单」抽象——每个扩展自己决定页面长什么样。

## 用法

```json
{
  "dependencies": {
    "@taterdoge/ui": "workspace:*"
  }
}
```

```tsx
// 组件：源码级共享，不是编译产物，可以照常改 className
import { Button } from "@taterdoge/ui/components/ui/button";
import { Card, CardContent } from "@taterdoge/ui/components/ui/card";

// 主题
import { applyTheme, initialTheme } from "@taterdoge/ui/lib/theme.ts";
applyTheme(initialTheme());
```

```css
/* web/src/styles.css —— 必须先引共享表，再写本扩展自己的覆盖 */
@import "@taterdoge/ui/styles.css";
```

## 导出

| 路径 | 内容 |
| --- | --- |
| `components/ui/*` | shadcn 生成件（button / card / checkbox / field / input / label / select / separator / switch / tabs / textarea） |
| `lib/theme.ts` | `initialTheme` / `applyTheme` / `THEME_STORAGE_KEY` |
| `styles.css` | Tailwind 入口 + `base-nova` 设计令牌（light / dark 变量） |

## 消费方必须自己装

组件依赖是 peer：`@base-ui/react` `class-variance-authority` `cn` `lucide-react` `react` `react-dom` `tailwindcss` `tw-animate-css`。共享源码如果不让消费方声明这些，会撞上重复 React 与 tree-shaking 失效。

## 加组件

```sh
bunx shadcn@latest add <name>   # 在本目录执行，components.json 已配好 base-nova
```

生成后把文件里的 `@/components/ui/x` 别名导入改成相对路径 `./x.tsx`——共享包不能依赖消费方的 path alias。

## 设计边界

- ✅ shadcn 组件、设计令牌、主题工具
- ❌ 设置表单框架、字段描述协议、HTTP server、路由、鉴权

第二条是本包存在的理由：不同扩展的表现形式差别极大（表单、拖拽画布、时间轴…），把渲染方式抽象进共享层只会让它退化成表达力极低的 DSL。
