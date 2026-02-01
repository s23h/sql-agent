---
name: chart-style-guide
description: Apply consistent, professional styling to data visualizations. Use when creating charts, graphs, or plots with matplotlib/seaborn. Ensures green gradient palette, monospace titles, data labels, and clean axes matching our product aesthetic.
---

# Data Visualization Style Guide

## Design Philosophy

- **Clarity over decoration** - Every visual element should aid comprehension
- **Data-ink ratio** - Remove non-essential visual elements
- **Sort logically** - Rankings should be descending (highest first)
- **Consistent styling** - Same palette, fonts, and spacing across all charts

## Color Palette

### Sequential (for ranked/ordered data)
Use gradient from dark (high values) to light (low values):

```python
COLORS_SEQUENTIAL = ['#1a6642', '#2d8659', '#4a9f6e', '#6bb885', '#8fd4a0']
```

### Categorical (for distinct groups)
```python
COLORS_CATEGORICAL = ['#1a6642', '#4a7c94', '#d4a03c', '#8b5a6b', '#5d7a5d', '#6b7b8a']
```

### Semantic
```python
COLORS_SEMANTIC = {
    'highlight': '#1a6642',  # Forest green
    'warning': '#d4a03c',    # Amber
    'error': '#b55a4a',      # Muted red
}
```

## Standard Chart Setup

Always apply this style at the start of chart creation:

```python
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap

def apply_chart_style():
    """Apply consistent styling to all charts."""
    plt.rcParams.update({
        'figure.figsize': (10, 6),
        'figure.facecolor': 'white',
        'font.family': 'monospace',
        'axes.spines.top': False,
        'axes.spines.right': False,
        'axes.edgecolor': '#cccccc',
        'axes.titlesize': 14,
        'axes.titleweight': 'bold',
        'axes.labelsize': 11,
        'grid.color': '#e8e8e8',
        'grid.linewidth': 0.5,
    })

def create_gradient_colors(n, reverse=False):
    """Generate n colors from dark green to light green."""
    colors = ['#1a6642', '#8fd4a0']
    if reverse:
        colors = colors[::-1]
    cmap = LinearSegmentedColormap.from_list('green', colors, N=n)
    return [cmap(i/(n-1)) for i in range(n)]

def add_bar_labels(ax, bars, fmt='{:,.0f}'):
    """Add formatted value labels to horizontal bar chart."""
    for bar in bars:
        width = bar.get_width()
        ax.annotate(fmt.format(width),
            xy=(width, bar.get_y() + bar.get_height()/2),
            xytext=(5, 0), textcoords='offset points',
            ha='left', va='center', fontsize=9, color='#2d2d2d')
```

## Chart Type Selection

| Analysis Type | Recommended Chart | Key Style Points |
|--------------|-------------------|------------------|
| Ranking ("Top N...") | Horizontal bar | Sort descending, gradient colors, data labels outside |
| Trend over time | Line chart | 2pt line width, hollow circle markers |
| Part-to-whole | Donut chart | 40% ring width, start angle 90° |
| Distribution | Histogram | 20-30 bins, single color |
| Comparison | Grouped bar | Categorical colors, legend outside |

## Horizontal Bar Chart Template

```python
apply_chart_style()
fig, ax = plt.subplots()

# Sort descending (ascending=True for horizontal puts highest at top)
data = data.sort_values('value', ascending=True)
colors = create_gradient_colors(len(data), reverse=True)

bars = ax.barh(data['label'], data['value'], color=colors)
add_bar_labels(ax, bars)

ax.set_xlabel('Value')
ax.set_title('Top Items by Value')
ax.grid(axis='x', alpha=0.3)

plt.tight_layout()
plt.savefig('/home/user/chart.png', dpi=150, bbox_inches='tight')
plt.close()
```

## Line Chart Template

```python
apply_chart_style()
fig, ax = plt.subplots()

ax.plot(data['date'], data['value'],
        color='#1a6642', linewidth=2,
        marker='o', markersize=6,
        markerfacecolor='white', markeredgewidth=1.5)

ax.set_xlabel('Date')
ax.set_ylabel('Value')
ax.set_title('Trend Over Time')
ax.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig('/home/user/trend.png', dpi=150, bbox_inches='tight')
plt.close()
```

## Donut Chart Template

```python
apply_chart_style()
fig, ax = plt.subplots()

colors = create_gradient_colors(len(data))
wedges, texts, autotexts = ax.pie(
    data['value'],
    labels=data['label'],
    colors=colors,
    autopct='%1.1f%%',
    startangle=90,
    wedgeprops={'width': 0.4, 'edgecolor': 'white', 'linewidth': 2}
)

ax.set_title('Distribution by Category')

plt.tight_layout()
plt.savefig('/home/user/donut.png', dpi=150, bbox_inches='tight')
plt.close()
```

## Always Save Charts

```python
plt.tight_layout()
plt.savefig('/home/user/chart.png', dpi=150, bbox_inches='tight', facecolor='white')
plt.close()
```
