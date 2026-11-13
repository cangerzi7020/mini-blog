---
title: 线性回归
course: 机器学习（示例）
date: 2026-11-12
instructor: 示例教师
tags: [机器学习-回归-方法, 机器学习-基础-概念]
status: 已整理
---

# 线性回归（2026-11-12）

> 本文件是格式示例，演示一篇「已整理」笔记的完整形态。第一篇真实笔记建好后可直接删除，并运行 `python tools/notes.py index`。

[返回索引](_index.md)

## 一、笔记内容

### 1. 本次要点

1. 线性回归用输入特征的线性组合拟合连续输出，模型形式为 $\hat{y} = \mathbf{w}^\top\mathbf{x} + b$。
2. 最小二乘法通过最小化残差平方和求解参数，得到闭式解 $\boldsymbol{\theta}^* = (\tilde{\mathbf{X}}^\top\tilde{\mathbf{X}})^{-1}\tilde{\mathbf{X}}^\top\mathbf{y}$。
3. 闭式解存在的前提是 $\tilde{\mathbf{X}}^\top\tilde{\mathbf{X}}$ 可逆，即特征矩阵列满秩，否则需改用岭回归。

### 2. 正文

#### 模型形式

给定输入 $\mathbf{x} \in \mathbb{R}^d$，预测值为

$$
\hat{y} = \mathbf{w}^\top \mathbf{x} + b
$$

把偏置并入权重后可写作 $\hat{y} = \boldsymbol{\theta}^\top\tilde{\mathbf{x}}$，其中 $\tilde{\mathbf{x}} = [1, \mathbf{x}^\top]^\top$。

#### 目标函数

$$
L(\boldsymbol{\theta}) = \frac{1}{2}\sum_{i=1}^{n}\left(\boldsymbol{\theta}^\top \tilde{\mathbf{x}}_i - y_i\right)^2
= \frac{1}{2}\left\lVert \tilde{\mathbf{X}}\boldsymbol{\theta} - \mathbf{y} \right\rVert_2^2
$$

#### 求解

对目标函数求梯度并令其为零：

$$
\nabla_{\boldsymbol{\theta}} L = \tilde{\mathbf{X}}^\top\left(\tilde{\mathbf{X}}\boldsymbol{\theta} - \mathbf{y}\right) = 0
\quad\Longrightarrow\quad
\boldsymbol{\theta}^* = \left(\tilde{\mathbf{X}}^\top \tilde{\mathbf{X}}\right)^{-1}\tilde{\mathbf{X}}^\top \mathbf{y}
$$

当 $\tilde{\mathbf{X}}^\top\tilde{\mathbf{X}}$ 不可逆时，改用岭回归：

$$
\boldsymbol{\theta}^* = \left(\tilde{\mathbf{X}}^\top \tilde{\mathbf{X}} + \lambda \mathbf{I}\right)^{-1}\tilde{\mathbf{X}}^\top \mathbf{y}
$$

#### 流程示意

```mermaid
flowchart LR
    A[收集样本] --> B[构造特征矩阵]
    B --> C[求解参数]
    C --> D[评估残差]
    D -->|不满足| B
    D -->|满足| E[输出模型]
```

### 3. 重点与易错点

- 训练误差低不代表泛化好，必须留出验证集再看效果。
- 特征量纲差异大时，L2 正则项会偏袒小量纲特征，因此标准化要在正则化之前做。
- 用均方误差评估时，注意它与目标函数只差一个常数因子 $1/n$，不要混用两种写法的数值。

### 4. 疑问与待办

- [ ] 为什么加入 L2 正则后一定可逆？（提示：半正定 + 单位阵正定）
- [ ] 补充一个用梯度下降替代闭式解的例子
- [ ] 对照教材第 3 章核对符号约定

## 二、名词解释

| 名词 | 英文 / 别名 | 解释 | 备注 |
| --- | --- | --- | --- |
| 线性回归 | Linear Regression | 用输入特征的线性组合拟合连续目标值的监督学习方法，参数可通过最小化残差平方和求得 | 输出连续值；分类问题应改用逻辑回归 |
| 最小二乘 | Ordinary Least Squares, OLS | 以残差平方和为目标函数、对其求导置零得到参数闭式解的拟合方法 | 与岭回归区别：目标函数不含正则项 |
| 岭回归 | Ridge Regression | 在最小二乘目标上加入 L2 正则项、使参数估计在特征共线时仍可求解的线性回归变体 | 正则系数 $\lambda$ 越大，参数收缩越强 |

## 三、参考资料

| 编号 | 类型 | 标题 | 作者 / 来源 | 年份 | 位置 | 链接 |
| --- | --- | --- | --- | --- | --- | --- |
| R001 | 教材 | 示例教材 | 示例作者 | 2026 | 第 3 章 | 待补充 |

用于核对本章的符号约定与闭式解推导步骤；示例资料，真实记录时替换为可访问链接。

## 修订记录

| 日期 | 修改内容 |
| --- | --- |
| 2026-11-12 | 建立笔记，补全推导与名词解释 |
