import { style } from 'typestyle';
import { PFColors, PFColorVal, PFColorVals } from '../../../components/Pf/PfColors';
import { DEGRADED, FAILURE } from '../../../types/Health';
import {
  BoxByType,
  CytoscapeGlobalScratchData,
  CytoscapeGlobalScratchNamespace,
  EdgeLabelMode,
  GraphType,
  NodeType,
  numLabels,
  Protocol,
  TrafficRate,
  UNKNOWN
} from '../../../types/Graph';
import { icons, serverConfig } from '../../../config';
import NodeImageTopology from '../../../assets/img/node-background-topology.png';
import NodeImageKey from '../../../assets/img/node-background-key.png';
import { CyNode, decoratedEdgeData, decoratedNodeData } from '../CytoscapeGraphUtils';
import _ from 'lodash';
import * as Cy from 'cytoscape';
import { PFBadges } from 'components/Pf/PfBadges';
import { config } from 'config/Config';

export const HighlightClass = 'mousehighlight';
export const HoveredClass = 'mousehover';
export const UnhighlightClass = 'mouseunhighlight';

let EdgeColor: PFColorVal;
let EdgeColorDead: PFColorVal;
let EdgeColorDegraded: PFColorVal;
let EdgeColorFailure: PFColorVal;
let EdgeColorTCPWithTraffic: PFColorVal;
const EdgeIconMTLS = icons.istio.mtls.ascii; // lock
let EdgeTextOutlineColor: PFColorVal;
const EdgeTextOutlineWidth = '1px';
const EdgeTextFont = 'Verdana,Arial,Helvetica,sans-serif,pficon';
const EdgeWidth = 2;
const EdgeWidthSelected = 4;
const FontSizeRatioEdgeText = 0.8;
const FontSizeRatioHover = 1.2;
const FontSizeRatioHoverBox = 1.3;
const NodeBorderWidth = '1px';
const NodeBorderWidthSelected = '3px';
let NodeColorBorder: PFColorVal;
let NodeColorBorderBox: PFColorVal;
let NodeColorBorderDegraded: PFColorVal;
let NodeColorBorderFailure: PFColorVal;
let NodeColorBorderHover: PFColorVal;
let NodeColorBorderSelected: PFColorVal;
let NodeColorFill: PFColorVal;
let NodeColorFillBoxApp: PFColorVal;
let NodeColorFillBoxCluster: PFColorVal;
let NodeColorFillBoxNamespace: PFColorVal;
let NodeColorFillHover: PFColorVal;
let NodeColorFillHoverDegraded: PFColorVal;
let NodeColorFillHoverFailure: PFColorVal;
const NodeHeight = '25px';
const NodeIconCB = icons.istio.circuitBreaker.className; // bolt
const NodeIconFaultInjection = icons.istio.faultInjection.className; // ban
const NodeIconGateway = icons.istio.gateway.className; // globe
const NodeIconMirroring = icons.istio.mirroring.className; // migration
const NodeIconMS = icons.istio.missingSidecar.className; // blueprint
const NodeIconRoot = icons.istio.root.className; // alt-arrow-circle-right
const NodeIconVS = icons.istio.virtualService.className; // code-branch
const NodeIconRequestRouting = icons.istio.requestRouting.className; // code-branch
const NodeIconRequestTimeout = icons.istio.requestTimeout.className; // clock
const NodeIconTrafficShifting = icons.istio.trafficShifting.className; // share-alt
const NodeIconWorkloadEntry = icons.istio.workloadEntry.className; // pf-icon-virtual-machine
const NodeTextColor = PFColors.Black1000;
const NodeTextColorBox = PFColors.White;
const NodeTextBackgroundColor = PFColors.White;
const NodeTextBackgroundColorBox = PFColors.Black700;
const NodeBadgeBackgroundColor = PFColors.Purple500;
const NodeBadgeColor = PFColors.White;
const NodeTextFont = EdgeTextFont;
const NodeWidth = NodeHeight;
const OpacityOverlay = 0.3;
const OpacityUnhighlight = 0.1;

// Puts a little more space between icons when a badge has multiple icons
const badgeMargin = (existingIcons: string) =>
  existingIcons === '' ? style({ marginLeft: '1px' }) : style({ marginRight: '2px' });

const badgesDefault = style({
  alignItems: 'center',
  backgroundColor: NodeBadgeBackgroundColor,
  borderTopLeftRadius: '3px',
  borderBottomLeftRadius: '3px',
  color: NodeBadgeColor,
  display: 'flex',
  padding: '3px 3px'
});

const contentBoxPfBadge = style({
  backgroundColor: PFColors.Badge,
  marginRight: '5px',
  minWidth: '24px', // reduce typical minWidth for badge to save label space
  paddingLeft: '0px',
  paddingRight: '0px'
});

const contentDefault = style({
  alignItems: 'center',
  backgroundColor: NodeTextBackgroundColor,
  borderRadius: '3px',
  borderWidth: '1px',
  color: NodeTextColor,
  padding: '3px 5px'
});

const contentBox = style({
  backgroundColor: NodeTextBackgroundColorBox,
  color: NodeTextColorBox
});

const contentWithBadges = style({
  borderBottomLeftRadius: 'unset',
  borderColor: NodeBadgeBackgroundColor,
  borderStyle: 'solid',
  borderTopLeftRadius: 'unset',
  borderLeft: '0'
});

const hostsClass = style({
  $nest: {
    '& div:last-child': {
      display: 'none'
    },
    '&:hover div:last-child': {
      display: 'block'
    }
  }
});

const hostsList = style({
  textAlign: 'initial',
  marginTop: 2,
  paddingTop: 2,
  borderTop: `1px solid ${PFColors.Black600}`
});

const labelDefault = style({
  borderRadius: '3px',
  boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.2), 0 2px 8px 0 rgba(0, 0, 0, 0.19)',
  display: 'inline-flex',
  fontFamily: NodeTextFont,
  fontWeight: 'normal',
  marginTop: '4px',
  textAlign: 'center'
});

const labelBox = style({
  marginTop: '13px'
});

export class GraphStyles {
  static runtimeColorsSet: boolean;

  // Our node color choices are defined by UX here:
  // - https://github.com/kiali/kiali/issues/2435#issuecomment-404640317
  // - https://github.com/kiali/kiali/issues/3675#issuecomment-807403919
  static setRuntimeColors = () => {
    if (GraphStyles.runtimeColorsSet) {
      return;
    }
    GraphStyles.runtimeColorsSet = true;

    EdgeColor = PFColorVals.Success;
    EdgeColorDead = PFColorVals.Black500;
    EdgeColorDegraded = PFColorVals.Warning;
    EdgeColorFailure = PFColorVals.Danger;
    EdgeColorTCPWithTraffic = PFColorVals.Blue600;
    EdgeTextOutlineColor = PFColorVals.White;
    NodeColorBorder = PFColorVals.Black500;
    NodeColorBorderBox = PFColorVals.Black600;
    NodeColorBorderDegraded = PFColorVals.Warning;
    NodeColorBorderFailure = PFColorVals.Danger;
    NodeColorBorderHover = PFColorVals.Blue300;
    NodeColorBorderSelected = PFColorVals.Blue300;
    NodeColorFill = PFColorVals.White;
    NodeColorFillBoxApp = PFColorVals.White;
    NodeColorFillBoxCluster = PFColorVals.Black300;
    NodeColorFillBoxNamespace = PFColorVals.Black100;
    NodeColorFillHover = PFColorVals.Blue50;
    NodeColorFillHoverDegraded = '#fdf2e5'; // roughly an Orange50 if it were defined
    NodeColorFillHoverFailure = '#ffe6e6'; // very close to Red50 if we want to change
  };

  static options() {
    return { wheelSensitivity: 0.1, autounselectify: false, autoungrabify: true };
  }

  static getNodeLabel(ele: Cy.NodeSingular) {
    const getCyGlobalData = (ele: Cy.NodeSingular): CytoscapeGlobalScratchData => {
      return ele.cy().scratch(CytoscapeGlobalScratchNamespace);
    };

    const cyGlobal = getCyGlobalData(ele);
    const settings = serverConfig.kialiFeatureFlags.uiDefaults.graph.settings;
    const zoom = ele.cy().zoom();
    const noBadge = !cyGlobal.forceLabels && zoom < settings.minFontBadge / settings.fontLabel;
    const noContent = !cyGlobal.forceLabels && zoom < settings.minFontLabel / settings.fontLabel;

    const node = decoratedNodeData(ele);
    const app = node.app || '';
    const cluster = node.cluster;
    const namespace = node.namespace;
    const nodeType = node.nodeType;
    const service = node.service || '';
    const version = node.version || '';
    const workload = node.workload || '';
    const isBox = node.isBox;
    const isBoxed = node.parent;
    const box1 = isBoxed ? ele.parent()[0] : undefined;
    const box1Type = box1 ? box1.data().isBox : undefined;
    const box2 = box1 && box1.parent() ? box1.parent()[0] : undefined;
    const box2Type = box2 ? box2.data().isBox : undefined;
    // const box3 = box2 && box2.parent() ? box2.parent()[0] : undefined;
    // const box3Type = box3 ? box3.data().isBox : undefined;
    const isAppBoxed = box1Type === BoxByType.APP;
    const isNamespaceBoxed = box1Type === BoxByType.NAMESPACE || box2Type === BoxByType.NAMESPACE;
    // const isClusterBoxed = box1Type === BoxByType.CLUSTER || box2Type === BoxByType.CLUSTER || box3Type === BoxByType.CLUSTER;
    const isMultiNamespace = cyGlobal.activeNamespaces.length > 1;
    const isOutside = node.isOutside;

    // Badges portion of label...

    let badges = '';
    if (cyGlobal.showMissingSidecars && node.hasMissingSC) {
      badges = `<span class="${NodeIconMS} ${badgeMargin(badges)}"></span> ${badges}`;
    }
    if (cyGlobal.showVirtualServices) {
      if (node.hasCB) {
        badges = `<span class="${NodeIconCB} ${badgeMargin(badges)}"></span> ${badges}`;
      }
      // If there's an additional traffic scenario present then it's assumed
      // that there is a VS present so the VS badge is omitted.
      if (node.hasVS) {
        const hasKialiScenario =
          node.hasFaultInjection ||
          node.hasMirroring ||
          node.hasRequestRouting ||
          node.hasRequestTimeout ||
          node.hasTCPTrafficShifting ||
          node.hasTrafficShifting;
        if (!hasKialiScenario) {
          badges = `<span class="${NodeIconVS} ${badgeMargin(badges)}"></span> ${badges}`;
        } else {
          if (node.hasFaultInjection) {
            badges = `<span class="${NodeIconFaultInjection} ${badgeMargin(badges)}"></span> ${badges}`;
          }
          if (node.hasMirroring) {
            badges = `<span class="${NodeIconMirroring}  ${badgeMargin(badges)} ${style({
              marginTop: '1px'
            })}"></span> ${badges}`;
          }
          if (node.hasTrafficShifting || node.hasTCPTrafficShifting) {
            badges = `<span class="${NodeIconTrafficShifting} ${badgeMargin(badges)}"></span> ${badges}`;
          }
          if (node.hasRequestTimeout) {
            badges = `<span class="${NodeIconRequestTimeout} ${badgeMargin(badges)}"></span> ${badges}`;
          }
          if (node.hasRequestRouting) {
            badges = `<span class="${NodeIconRequestRouting} ${badgeMargin(badges)}"></span> ${badges}`;
          }
        }
      }

      if (node.hasWorkloadEntry) {
        badges = `<span class="${NodeIconWorkloadEntry} ${badgeMargin(badges)}"></span> ${badges}`;
      }
      if (node.isRoot) {
        if (node.isGateway?.ingressInfo?.hostnames?.length !== undefined) {
          badges = `<span class="${NodeIconGateway} ${badgeMargin(badges)}"></span> ${badges}`;
        }
        badges = `<span class="${NodeIconRoot} ${badgeMargin(badges)}"></span> ${badges}`;
      } else {
        if (node.isGateway?.egressInfo?.hostnames?.length !== undefined) {
          badges = `<span class="${NodeIconGateway} ${badgeMargin(badges)}"></span> ${badges}`;
        }
      }
    }

    const hasBadges = badges.length > 0;
    const noLabel = noContent && (noBadge || !hasBadges);

    if (hasBadges) {
      const badgesStyle = noLabel || !noBadge ? '' : 'display:none;';
      badges = `<div class="${badgesDefault}" style="${badgesStyle}">${badges}</div>`;
    }

    // Content portion of label (i.e. the text)...

    let contentStyle = '';
    if (ele.hasClass(HighlightClass)) {
      const fontSize =
        isBox && isBox !== BoxByType.APP
          ? settings.fontLabel * FontSizeRatioHoverBox
          : settings.fontLabel * FontSizeRatioHover;
      contentStyle = `font-size:${fontSize}px;`;
    } else {
      contentStyle = `font-size:${settings.fontLabel}px;`;
    }
    if (!noLabel && noContent) {
      contentStyle += 'display:none;';
    }

    const content: string[] = [];

    // append namespace if necessary
    if (
      (isMultiNamespace || isOutside) &&
      !!namespace &&
      namespace !== UNKNOWN &&
      !isAppBoxed &&
      !isNamespaceBoxed &&
      isBox !== BoxByType.NAMESPACE
    ) {
      content.push(`(${namespace})`);
    }

    // append cluster if necessary
    if (
      !!cluster &&
      cluster !== UNKNOWN &&
      cluster !== cyGlobal.homeCluster &&
      !isBoxed &&
      isBox !== BoxByType.CLUSTER
    ) {
      content.push(`(${cluster})`);
    }

    switch (nodeType) {
      case NodeType.AGGREGATE:
        content.unshift(node.aggregateValue!);
        break;
      case NodeType.APP:
        if (isAppBoxed) {
          if (cyGlobal.graphType === GraphType.APP) {
            content.unshift(app);
          } else if (version && version !== UNKNOWN) {
            content.unshift(version);
          } else {
            content.unshift(workload ? workload : app);
          }
        } else {
          if (cyGlobal.graphType === GraphType.APP || version === UNKNOWN) {
            content.unshift(app);
          } else {
            content.unshift(version);
            content.unshift(app);
          }
        }
        break;
      case NodeType.BOX:
        switch (isBox) {
          case BoxByType.APP:
            content.unshift(app);
            break;
          case BoxByType.CLUSTER:
            content.unshift(node.cluster);
            break;
          case BoxByType.NAMESPACE:
            content.unshift(node.namespace);
            break;
        }
        break;
      case NodeType.SERVICE:
        content.unshift(service);
        break;
      case NodeType.UNKNOWN:
        content.unshift(UNKNOWN);
        break;
      case NodeType.WORKLOAD:
        content.unshift(workload);
        break;
      default:
        content.unshift('error');
    }

    const contentText = content.join('<br/>');
    let contentClasses = hasBadges && !noBadge ? `${contentDefault} ${contentWithBadges}` : `${contentDefault}`;

    // The final label...
    let fontSize = settings.fontLabel;
    if (ele.hasClass(HighlightClass)) {
      fontSize = fontSize * FontSizeRatioHover;
    }
    const lineHeight = fontSize + 1;
    let labelStyle = `font-size:${fontSize}px;line-height:${lineHeight}px;`;
    if (ele.hasClass(UnhighlightClass)) {
      labelStyle += 'opacity:0.6;';
    }
    if (noLabel) {
      labelStyle += 'display:none;';
    }

    if (isBox) {
      let appBoxStyle = '';
      let pfBadge = '';
      switch (isBox) {
        case BoxByType.APP:
          pfBadge = PFBadges.App.badge;
          appBoxStyle += `font-size: ${settings.fontLabel}px;`;
          break;
        case BoxByType.CLUSTER:
          pfBadge = PFBadges.Cluster.badge;
          break;
        case BoxByType.NAMESPACE:
          pfBadge = PFBadges.Namespace.badge;
          break;
        default:
          console.warn(`GraphSyles: Unexpected box [${isBox}] `);
      }
      const contentPfBadge = `<span class="pf-c-badge pf-m-unread ${contentBoxPfBadge}" style="${appBoxStyle}">${pfBadge}</span>`;
      const contentSpan = `<span class="${contentClasses} ${contentBox}" style="${appBoxStyle} ${contentStyle}">${contentPfBadge}${contentText}</span>`;
      return `<div class="${labelDefault} ${labelBox}" style="${labelStyle}">${badges}${contentSpan}</div>`;
    }

    let hosts: string[] = [];
    node.hasVS?.hostnames?.forEach(h => hosts.push(h === '*' ? '* (all hosts)' : h));
    node.isGateway?.ingressInfo?.hostnames?.forEach(h => hosts.push(h === '*' ? '* (all hosts)' : h));
    node.isGateway?.egressInfo?.hostnames?.forEach(h => hosts.push(h === '*' ? '* (all hosts)' : h));

    let htmlHosts = '';
    if (hosts.length !== 0) {
      let hostsToShow = hosts;
      if (hostsToShow.length > config.graph.maxHosts) {
        hostsToShow = hosts.slice(0, config.graph.maxHosts);
        hostsToShow.push(
          hosts.length - config.graph.maxHosts === 1
            ? '1 more host...'
            : `${hosts.length - config.graph.maxHosts} more hosts...`
        );
      }
      htmlHosts = `<div class="${hostsList}">${hostsToShow.join('<br />')}</div>`;
    }

    if (hosts.length > 0) {
      contentClasses = `${contentClasses} ${hostsClass}`;
    }

    const contentSpan = `<div class="${contentClasses}" style="${contentStyle}"><div>${contentText}</div>${htmlHosts}</div>`;
    return `<div class="${labelDefault}" style="${labelStyle}">${badges}${contentSpan}</div>`;
  }

  static htmlNodeLabels(cy: Cy.Core) {
    return [
      {
        query: 'node[^isBox]:visible', // leaf nodes
        halign: 'center',
        valign: 'bottom',
        halignBox: 'center',
        valignBox: 'bottom',
        tpl: (data: any) => this.getNodeLabel(cy.$id(data.id))
      },
      {
        query: 'node[isBox = "app"]:visible', // app box nodes
        halign: 'center',
        valign: 'bottom',
        halignBox: 'center',
        valignBox: 'bottom',
        tpl: (data: any) => this.getNodeLabel(cy.$id(data.id))
      },
      {
        query: 'node[isBox = "namespace"]:visible', // ns box nodes
        halign: 'center',
        valign: 'bottom',
        halignBox: 'center',
        valignBox: 'bottom',
        tpl: (data: any) => this.getNodeLabel(cy.$id(data.id))
      },
      {
        query: 'node[isBox = "cluster"]:visible', // cluster box nodes
        halign: 'center',
        valign: 'bottom',
        halignBox: 'center',
        valignBox: 'bottom',
        tpl: (data: any) => this.getNodeLabel(cy.$id(data.id))
      }
    ];
  }

  static styles(): Cy.Stylesheet[] {
    GraphStyles.setRuntimeColors();

    const getCyGlobalData = (ele: Cy.NodeSingular | Cy.EdgeSingular): CytoscapeGlobalScratchData => {
      return ele.cy().scratch(CytoscapeGlobalScratchNamespace);
    };

    const getEdgeColor = (ele: Cy.EdgeSingular): string => {
      const edgeData = decoratedEdgeData(ele);

      if (!edgeData.hasTraffic) {
        return EdgeColorDead;
      }
      if (edgeData.protocol === 'tcp') {
        return EdgeColorTCPWithTraffic;
      }

      switch (edgeData.healthStatus) {
        case FAILURE.name:
          return EdgeColorFailure;
        case DEGRADED.name:
          return EdgeColorDegraded;
        default:
          return EdgeColor;
      }
    };

    const getEdgeLabel = (ele: Cy.EdgeSingular, isVerbose?: boolean): string => {
      const settings = serverConfig.kialiFeatureFlags.uiDefaults.graph.settings;
      const zoom = ele.cy().zoom();
      const noLabel = zoom < settings.minFontLabel / settings.fontLabel;

      if (noLabel) {
        return '';
      }

      const cyGlobal = getCyGlobalData(ele);
      const edgeLabels = cyGlobal.edgeLabels;
      const edgeData = decoratedEdgeData(ele);
      const includeUnits = isVerbose || numLabels(edgeLabels) > 1;
      let labels = [] as string[];

      if (edgeLabels.includes(EdgeLabelMode.TRAFFIC_RATE)) {
        let rate = 0;
        let pErr = 0;
        if (edgeData.http > 0) {
          rate = edgeData.http;
          pErr = edgeData.httpPercentErr > 0 ? edgeData.httpPercentErr : 0;
        } else if (edgeData.grpc > 0) {
          rate = edgeData.grpc;
          pErr = edgeData.grpcPercentErr > 0 ? edgeData.grpcPercentErr : 0;
        } else if (edgeData.tcp > 0) {
          rate = edgeData.tcp;
        }

        if (rate > 0) {
          if (pErr > 0) {
            labels.push(`${toFixedRequestRate(rate, includeUnits)}\n${toFixedErrRate(pErr)}`);
          } else {
            switch (edgeData.protocol) {
              case Protocol.GRPC:
                if (cyGlobal.trafficRates.includes(TrafficRate.GRPC_REQUEST)) {
                  labels.push(toFixedRequestRate(rate, includeUnits));
                } else {
                  labels.push(toFixedRequestRate(rate, includeUnits, 'mps'));
                }
                break;
              case Protocol.TCP:
                labels.push(toFixedByteRate(rate, includeUnits));
                break;
              default:
                labels.push(toFixedRequestRate(rate, includeUnits));
                break;
            }
          }
        }
      }

      if (edgeLabels.includes(EdgeLabelMode.RESPONSE_TIME_GROUP)) {
        let responseTime = edgeData.responseTime;

        if (responseTime > 0) {
          labels.push(toFixedDuration(responseTime));
        }
      }

      if (edgeLabels.includes(EdgeLabelMode.THROUGHPUT_GROUP)) {
        let rate = edgeData.throughput;

        if (rate > 0) {
          labels.push(toFixedByteRate(rate, includeUnits));
        }
      }

      if (edgeLabels.includes(EdgeLabelMode.TRAFFIC_DISTRIBUTION)) {
        let pReq;
        if (edgeData.httpPercentReq > 0) {
          pReq = edgeData.httpPercentReq;
        } else if (edgeData.grpcPercentReq > 0) {
          pReq = edgeData.grpcPercentReq;
        }
        if (pReq > 0 && pReq < 100) {
          labels.push(toFixedPercent(pReq));
        }
      }

      let label = labels.join('\n');

      if (isVerbose) {
        const protocol = edgeData.protocol;
        label = protocol ? `${protocol}\n${label}` : label;
      }

      const mtlsPercentage = edgeData.isMTLS;
      let lockIcon = false;
      if (cyGlobal.showSecurity && edgeData.hasTraffic) {
        if (mtlsPercentage && mtlsPercentage > 0) {
          lockIcon = true;
          label = `${EdgeIconMTLS}\n${label}`;
        }
      }

      if (edgeData.hasTraffic && edgeData.responses) {
        const dest = decoratedNodeData(ele.target());
        if (dest.hasCB) {
          const responses = edgeData.responses;
          for (let code of _.keys(responses)) {
            // TODO: Not 100% sure we want "UH" code here ("no healthy upstream hosts") but based on timing I have
            // seen this code returned and not "UO". "UO" is returned only when the circuit breaker is caught open.
            // But if open CB is responsible for removing possible destinations the "UH" code seems preferred.
            if (responses[code]['UO'] || responses[code]['UH']) {
              label = lockIcon ? `${NodeIconCB} ${label}` : `${NodeIconCB}\n${label}`;
              break;
            }
          }
        }
      }

      return label;
    };

    const trimFixed = (fixed: string): string => {
      if (!fixed.includes('.')) {
        return fixed;
      }
      while (fixed.endsWith('0')) {
        fixed = fixed.slice(0, -1);
      }
      return fixed.endsWith('.') ? (fixed = fixed.slice(0, -1)) : fixed;
    };

    const toFixedRequestRate = (num: number, includeUnits: boolean, units?: string): string => {
      num = safeNum(num);
      const rate = trimFixed(num.toFixed(2));
      return includeUnits ? `${rate} ${units || 'rps'}` : rate;
    };

    const toFixedErrRate = (num: number): string => {
      num = safeNum(num);
      return `${trimFixed(num.toFixed(num < 1 ? 1 : 0))}% err`;
    };

    const toFixedByteRate = (num: number, includeUnits: boolean): string => {
      num = safeNum(num);
      if (num < 1024.0) {
        const rate = num < 1.0 ? trimFixed(num.toFixed(2)) : num.toFixed(0);
        return includeUnits ? `${rate} bps` : rate;
      }
      const rate = trimFixed((num / 1024.0).toFixed(2));
      return includeUnits ? `${rate} kps` : rate;
    };

    const toFixedPercent = (num: number): string => {
      num = safeNum(num);
      return `${trimFixed(num.toFixed(1))}%`;
    };

    const toFixedDuration = (num: number): string => {
      num = safeNum(num);
      if (num < 1000) {
        return `${num.toFixed(0)}ms`;
      }
      return `${trimFixed((num / 1000.0).toFixed(2))}s`;
    };

    // This is due to us never having figured out why a tiny fraction of what-we-expect-to-be-numbers
    // are in fact strings.  We don't know if our conversion in GraphData.ts has a flaw, or whether
    // something else happens post-conversion.
    const safeNum = (num: any): number => {
      if (Number.isFinite(num)) {
        return num;
      }
      if (typeof num === 'string' || num instanceof String) {
        console.log(`Expected number but received string: |${num}|`);
      }
      // this will return NaN if the string is 'NaN' or any other non-number
      return Number(num);
    };

    const getNodeBackgroundImage = (ele: Cy.NodeSingular): string => {
      const nodeData = decoratedNodeData(ele);
      const isInaccessible = nodeData.isInaccessible;
      const isServiceEntry = nodeData.isServiceEntry;
      const isBox = nodeData.isBox;
      if (isInaccessible && !isServiceEntry && !isBox) {
        return NodeImageKey;
      }
      const isOutside = nodeData.isOutside;
      if (isOutside && !isBox) {
        return NodeImageTopology;
      }
      return 'none';
    };

    const getNodeBackgroundPositionX = (ele: Cy.NodeSingular): string => {
      if (getNodeShape(ele) === 'round-tag') {
        return '0';
      }
      return '50%';
    };

    const getNodeBackgroundPositionY = (ele: Cy.NodeSingular): string => {
      if (getNodeShape(ele) === 'round-triangle') {
        return '6px';
      }
      return '50%';
    };

    const getNodeBorderColor = (ele: Cy.NodeSingular): string => {
      const isBox = ele.data(CyNode.isBox);
      if (isBox && isBox !== BoxByType.APP) {
        return NodeColorBorderBox;
      }

      const healthStatus = ele.data(CyNode.healthStatus);
      switch (healthStatus) {
        case DEGRADED.name:
          return NodeColorBorderDegraded;
        case FAILURE.name:
          return NodeColorBorderFailure;
        default:
          return NodeColorBorder;
      }
    };

    const getNodeShape = (ele: Cy.NodeSingular): Cy.Css.NodeShape => {
      const nodeData = decoratedNodeData(ele);
      const nodeType = nodeData.nodeType;
      switch (nodeType) {
        case NodeType.AGGREGATE:
          return 'round-pentagon';
        case NodeType.APP:
          return 'round-rectangle';
        case NodeType.BOX:
          return 'round-rectangle';
        case NodeType.SERVICE:
          return nodeData.isServiceEntry ? 'round-tag' : 'round-triangle';
        case NodeType.UNKNOWN:
          return 'ellipse';
        case NodeType.WORKLOAD:
          return 'ellipse';
        default:
          return 'ellipse';
      }
    };

    const nodeSelectedStyle = {
      'border-color': (ele: Cy.NodeSingular) => {
        switch (ele.data(CyNode.healthStatus)) {
          case DEGRADED.name:
            return NodeColorBorderDegraded;
          case FAILURE.name:
            return NodeColorBorderFailure;
          default:
            return NodeColorBorderSelected;
        }
      },
      'border-width': NodeBorderWidthSelected
    };

    return [
      // Node Defaults
      {
        selector: 'node',
        css: {
          'background-color': NodeColorFill,
          'background-image': (ele: Cy.NodeSingular) => {
            return getNodeBackgroundImage(ele);
          },
          'background-width': '80%',
          'background-height': '80%',
          'background-position-x': getNodeBackgroundPositionX,
          'background-position-y': getNodeBackgroundPositionY,
          'border-color': (ele: Cy.NodeSingular) => {
            return getNodeBorderColor(ele);
          },
          'border-style': (ele: Cy.NodeSingular) => {
            return decoratedNodeData(ele).isIdle ? 'dotted' : 'solid';
          },
          'border-width': NodeBorderWidth,
          ghost: 'yes',
          'ghost-offset-x': 1,
          'ghost-offset-y': 1,
          'ghost-opacity': 0.4,
          height: NodeHeight,
          shape: (ele: Cy.NodeSingular) => {
            return getNodeShape(ele);
          },
          width: NodeWidth,
          'z-index': 10
        }
      },
      // Node is a Cluster Box
      {
        selector: `node[isBox="${BoxByType.CLUSTER}"]`,
        css: {
          'background-color': NodeColorFillBoxCluster
        }
      },
      // Node is a Namespace Box
      {
        selector: `node[isBox="${BoxByType.NAMESPACE}"]`,
        css: {
          'background-color': NodeColorFillBoxNamespace
        }
      },
      // Node is an App Box
      {
        selector: `node[isBox="${BoxByType.APP}"]`,
        css: {
          'background-color': NodeColorFillBoxApp
        }
      },
      // Node is selected
      {
        selector: 'node:selected',
        style: nodeSelectedStyle
      },
      // Node other than Box is highlighted (see GraphHighlighter.ts)
      {
        selector: `node.${HighlightClass}[^isBox]`,
        style: {
          'background-color': (ele: Cy.NodeSingular) => {
            switch (ele.data(CyNode.healthStatus)) {
              case DEGRADED.name:
                return NodeColorFillHoverDegraded;
              case FAILURE.name:
                return NodeColorFillHoverFailure;
              default:
                return NodeColorFillHover;
            }
          },
          'border-color': (ele: Cy.NodeSingular) => {
            switch (ele.data(CyNode.healthStatus)) {
              case DEGRADED.name:
                return NodeColorBorderDegraded;
              case FAILURE.name:
                return NodeColorBorderFailure;
              default:
                return NodeColorBorderHover;
            }
          }
        }
      },
      // Node is unhighlighted (see GraphHighlighter.ts)
      {
        selector: `node.${UnhighlightClass}`,
        style: {
          opacity: OpacityUnhighlight
        }
      },
      {
        selector: 'edge',
        css: {
          'curve-style': 'bezier',
          'font-family': EdgeTextFont,
          'font-size': `${
            serverConfig.kialiFeatureFlags.uiDefaults.graph.settings.fontLabel * FontSizeRatioEdgeText
          }px`,
          label: (ele: Cy.EdgeSingular) => {
            return getEdgeLabel(ele);
          },
          'line-color': (ele: Cy.EdgeSingular) => {
            return getEdgeColor(ele);
          },
          'line-style': 'solid',
          'target-arrow-shape': 'vee',
          'target-arrow-color': (ele: Cy.EdgeSingular) => {
            return getEdgeColor(ele);
          },
          'text-events': 'yes',
          'text-outline-color': EdgeTextOutlineColor,
          'text-outline-width': EdgeTextOutlineWidth,
          'text-wrap': 'wrap',
          width: EdgeWidth
        }
      },
      {
        selector: 'edge:selected',
        css: {
          width: EdgeWidthSelected,
          label: (ele: Cy.EdgeSingular) => getEdgeLabel(ele, true)
        }
      },
      {
        selector: 'edge[protocol="tcp"]',
        css: {
          'target-arrow-shape': 'triangle-cross',
          'line-style': 'solid'
        }
      },
      {
        selector: `edge.${HighlightClass}`,
        style: {
          'font-size': `${serverConfig.kialiFeatureFlags.uiDefaults.graph.settings.fontLabel}px`
        }
      },
      {
        selector: `edge.${HoveredClass}`,
        style: {
          label: (ele: Cy.EdgeSingular) => {
            return getEdgeLabel(ele);
          }
        }
      },
      {
        selector: `edge.${UnhighlightClass}`,
        style: {
          opacity: OpacityUnhighlight
        }
      },
      {
        selector: '*.find[^isBox]',
        style: {
          'overlay-color': PFColorVals.Gold400,
          'overlay-padding': '7px',
          'overlay-opacity': OpacityOverlay
        }
      },
      {
        selector: '*.span[^isBox]',
        style: {
          'overlay-color': PFColorVals.Purple200,
          'overlay-padding': '7px',
          'overlay-opacity': OpacityOverlay
        }
      }
    ];
  }
}
