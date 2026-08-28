# =====================================================================
# 变更履历
# 2026-08-28  由根目录 create_traeshort.ps1 迁入 scripts/ 并改写：
#             1) 拆链改用 `cmd /c rmdir`（PowerShell 5.1 的
#                Remove-Item -Recurse 对 junction 存在穿透删除目标内容的风险）；
#             2) 新增孤儿 junction 清理（目标已删除的残留链接）；
#             3) 补充用途与边界说明注释。
# =====================================================================
# 用途：把 .claude/skills/<name>（AI 开发规范的正典技能，已入 git）
#       以 Windows junction 的形式桥接到两个"读取方"目录：
#         .agents/skills  —— dsh skill-filesystem 的 rank-200 项目技能发现根
#                            （上游契约路径，不可改名）；
#         .trae/skills    —— Trae 编辑器的项目技能目录约定。
# 为什么用 junction：junction 无法跨平台提交（git 不会还原），故 .agents/、
#       .trae/ 均在 .gitignore 中忽略，clone 后需在本机重跑本脚本重建桥接。
# 边界：rmdir 只拆链接本身，绝不会触碰 junction 指向的目标内容；
#       禁止用 rm -rf / Remove-Item -Recurse 直接删除 junction 路径。
# =====================================================================

# 桥接目标目录清单：键为读取方目录，值为该目录的用途说明
$targets = @(
    @{ Dir = ".agents\skills"; Desc = "dsh 项目技能发现根（rank-200）" },
    @{ Dir = ".trae\skills";   Desc = "Trae 编辑器技能目录" }
)

# 源集合：正典技能目录 .claude/skills 下的每个子目录（不硬编码名单，增删技能自动跟随）
$skills = Get-ChildItem -Path ".claude\skills" -Directory

foreach ($t in $targets) {
    $dest = $t.Dir

    # 1) 清理孤儿链接：读取方目录下"是链接但目标已不存在"的残留（如技能被删除后遗留的 junction）
    if (Test-Path $dest) {
        Get-ChildItem -Path $dest -Directory | ForEach-Object {
            $target = $_.Target   # PowerShell 5.1+：junction/符号链接会暴露 Target 属性
            if ($target -and -not (Test-Path $target)) {
                cmd /c rmdir "$($_.FullName)"
                Write-Host "[清理] 孤儿链接 $($_.FullName)（目标 $target 已不存在）"
            }
        }
    }
    else {
        New-Item -ItemType Directory -Force -Path $dest | Out-Null
    }

    # 2) 建链：已存在同名链接的先拆（rmdir 拆链不碰目标），再重建指向正典的 junction
    foreach ($s in $skills) {
        $link = Join-Path $dest $s.Name
        if (Test-Path $link) { cmd /c rmdir "$link" }
        cmd /c mklink /J "$link" "$($s.FullName)" | Out-Null
        Write-Host "[建链] $link -> $($s.FullName)（$($t.Desc)）"
    }
}

Write-Host "完成：$($skills.Count) 个技能已桥接到 $($targets.Count) 个读取方目录。"
